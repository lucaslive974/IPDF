use crate::adapters::cloud::http_transport::{HttpMethod, HttpRequest, HttpTransport};
use crate::core::domain::PlatformKind;
use crate::core::ports::{
    AuthToken, CloudAuthKind, CloudAuthProvider, CloudCredentialStore, CloudProviderDescriptor,
    CloudSession,
};
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use percent_encoding::{utf8_percent_encode, AsciiSet, NON_ALPHANUMERIC};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::sync::Arc;

pub const GOOGLE_DRIVE_PROVIDER_ID: &str = "google_drive";
pub const GOOGLE_DRIVE_APPDATA_SCOPE: &str = "https://www.googleapis.com/auth/drive.appdata";
const GOOGLE_AUTH_ENDPOINT: &str = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT: &str = "https://oauth2.googleapis.com/token";
const GOOGLE_REVOKE_ENDPOINT: &str = "https://oauth2.googleapis.com/revoke";
const TOKEN_REFRESH_LEEWAY_MS: i64 = 60_000;

const SUPPORTED_PLATFORMS: &[PlatformKind] = &[
    PlatformKind::Linux,
    PlatformKind::Windows,
    PlatformKind::Android,
    PlatformKind::Ios,
];

/// Configuration for Google OAuth2 PKCE authentication.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GoogleOAuthConfig {
    pub client_id: String,
    pub client_secret: Option<String>,
    pub redirect_uri: String,
    pub scope: String,
}

impl GoogleOAuthConfig {
    pub fn new(
        client_id: impl Into<String>,
        client_secret: Option<String>,
        redirect_uri: impl Into<String>,
    ) -> Self {
        Self {
            client_id: client_id.into(),
            client_secret: client_secret.filter(|s| !s.trim().is_empty()),
            redirect_uri: redirect_uri.into(),
            scope: GOOGLE_DRIVE_APPDATA_SCOPE.to_string(),
        }
    }

    /// Resolves compile-time Google OAuth credentials (`SCHOLARIUM_GOOGLE_CLIENT_ID`
    /// and optional `SCHOLARIUM_GOOGLE_CLIENT_SECRET`).
    pub fn resolve(redirect_uri: impl Into<String>) -> Result<Self, String> {
        let client_id = option_env!("SCHOLARIUM_GOOGLE_CLIENT_ID")
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(str::to_string)
            .ok_or_else(|| {
                "Google OAuth client ID is not configured (set SCHOLARIUM_GOOGLE_CLIENT_ID at build time)"
                    .to_string()
            })?;

        let client_secret = option_env!("SCHOLARIUM_GOOGLE_CLIENT_SECRET")
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(str::to_string);

        Ok(Self::new(client_id, client_secret, redirect_uri))
    }
}

/// PKCE verifier/challenge pair for S256 OAuth2 authorization.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PkceChallenge {
    pub code_verifier: String,
    pub code_challenge: String,
    pub state: String,
}

impl PkceChallenge {
    pub fn from_entropy(verifier_seed: &[u8], state_seed: &[u8]) -> Self {
        let code_verifier = URL_SAFE_NO_PAD.encode(verifier_seed);
        let mut hasher = Sha256::new();
        hasher.update(code_verifier.as_bytes());
        let digest = hasher.finalize();
        let code_challenge = URL_SAFE_NO_PAD.encode(digest);
        let state = URL_SAFE_NO_PAD.encode(state_seed);
        Self {
            code_verifier,
            code_challenge,
            state,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GoogleStoredCredentials {
    access_token: String,
    refresh_token: String,
    expires_at_ms: i64,
    account_label: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GoogleTokenResponse {
    access_token: String,
    expires_in: i64,
    refresh_token: Option<String>,
}

/// Google OAuth2 PKCE adapter implementing `CloudAuthProvider` using `drive.appdata` scope.
pub struct GoogleOAuthPkceAdapter {
    config: GoogleOAuthConfig,
    credentials: Arc<dyn CloudCredentialStore>,
    http: Arc<dyn HttpTransport>,
}

impl GoogleOAuthPkceAdapter {
    pub fn new(
        config: GoogleOAuthConfig,
        credentials: Arc<dyn CloudCredentialStore>,
        http: Arc<dyn HttpTransport>,
    ) -> Self {
        Self {
            config,
            credentials,
            http,
        }
    }

    pub fn build_authorization_url(&self, pkce: &PkceChallenge) -> String {
        let params = [
            ("client_id", self.config.client_id.as_str()),
            ("redirect_uri", self.config.redirect_uri.as_str()),
            ("response_type", "code"),
            ("scope", self.config.scope.as_str()),
            ("code_challenge", pkce.code_challenge.as_str()),
            ("code_challenge_method", "S256"),
            ("state", pkce.state.as_str()),
            ("access_type", "offline"),
            ("prompt", "consent"),
        ];
        format!("{GOOGLE_AUTH_ENDPOINT}?{}", encode_form_params(&params))
    }

    /// Exchanges an OAuth2 authorization code + PKCE verifier for access and refresh tokens.
    pub fn exchange_code(
        &self,
        code: &str,
        code_verifier: &str,
        account_label: Option<String>,
        now_ms: i64,
    ) -> Result<CloudSession, String> {
        let mut params = vec![
            ("client_id", self.config.client_id.as_str()),
            ("code", code),
            ("code_verifier", code_verifier),
            ("grant_type", "authorization_code"),
            ("redirect_uri", self.config.redirect_uri.as_str()),
        ];
        if let Some(secret) = &self.config.client_secret {
            params.push(("client_secret", secret.as_str()));
        }

        let token_res = self.request_token(&params)?;
        let refresh_token = token_res
            .refresh_token
            .ok_or_else(|| "Google OAuth response did not include a refresh_token".to_string())?;

        let stored = GoogleStoredCredentials {
            access_token: token_res.access_token,
            refresh_token,
            expires_at_ms: now_ms.saturating_add(token_res.expires_in.saturating_mul(1_000)),
            account_label: account_label.clone(),
        };
        self.save_stored(&stored)?;

        Ok(CloudSession {
            provider_id: GOOGLE_DRIVE_PROVIDER_ID.to_string(),
            account_label,
            connected: true,
        })
    }

    fn refresh_access_token(
        &self,
        stored: &GoogleStoredCredentials,
        now_ms: i64,
    ) -> Result<AuthToken, String> {
        let mut params = vec![
            ("client_id", self.config.client_id.as_str()),
            ("refresh_token", stored.refresh_token.as_str()),
            ("grant_type", "refresh_token"),
        ];
        if let Some(secret) = &self.config.client_secret {
            params.push(("client_secret", secret.as_str()));
        }

        let token_res = self.request_token(&params)?;
        let expires_at_ms = now_ms.saturating_add(token_res.expires_in.saturating_mul(1_000));
        let updated = GoogleStoredCredentials {
            access_token: token_res.access_token.clone(),
            refresh_token: token_res
                .refresh_token
                .unwrap_or_else(|| stored.refresh_token.clone()),
            expires_at_ms,
            account_label: stored.account_label.clone(),
        };
        self.save_stored(&updated)?;

        Ok(AuthToken {
            access_token: token_res.access_token,
            expires_at_ms,
        })
    }

    fn request_token(&self, params: &[(&str, &str)]) -> Result<GoogleTokenResponse, String> {
        let body = encode_form_params(params).into_bytes();
        let response = self.http.send(HttpRequest {
            method: HttpMethod::Post,
            url: GOOGLE_TOKEN_ENDPOINT.to_string(),
            headers: vec![(
                "Content-Type".to_string(),
                "application/x-www-form-urlencoded".to_string(),
            )],
            body,
        })?;

        if !(200..300).contains(&response.status) {
            let msg = String::from_utf8_lossy(&response.body);
            return Err(format!(
                "Google OAuth token request failed ({}): {msg}",
                response.status
            ));
        }

        serde_json::from_slice(&response.body)
            .map_err(|e| format!("Invalid Google OAuth token JSON: {e}"))
    }

    fn load_stored(&self) -> Result<Option<GoogleStoredCredentials>, String> {
        match self.credentials.get_secret(GOOGLE_DRIVE_PROVIDER_ID)? {
            Some(raw) => serde_json::from_str(&raw)
                .map(Some)
                .map_err(|e| format!("Invalid stored Google credentials: {e}")),
            None => Ok(None),
        }
    }

    fn save_stored(&self, creds: &GoogleStoredCredentials) -> Result<(), String> {
        let raw = serde_json::to_string(creds).map_err(|e| e.to_string())?;
        self.credentials.set_secret(GOOGLE_DRIVE_PROVIDER_ID, &raw)
    }
}

impl CloudAuthProvider for GoogleOAuthPkceAdapter {
    fn descriptor(&self) -> CloudProviderDescriptor {
        CloudProviderDescriptor {
            id: GOOGLE_DRIVE_PROVIDER_ID,
            display_name: "Google Drive",
            auth_kind: CloudAuthKind::OAuthPkce,
            supported_platforms: SUPPORTED_PLATFORMS,
        }
    }

    fn session(&self) -> Result<CloudSession, String> {
        match self.load_stored()? {
            Some(creds) => Ok(CloudSession {
                provider_id: GOOGLE_DRIVE_PROVIDER_ID.to_string(),
                account_label: creds.account_label,
                connected: true,
            }),
            None => Ok(CloudSession {
                provider_id: GOOGLE_DRIVE_PROVIDER_ID.to_string(),
                account_label: None,
                connected: false,
            }),
        }
    }

    fn get_valid_access_token(&self, now_ms: i64) -> Result<AuthToken, String> {
        let Some(creds) = self.load_stored()? else {
            return Err("Google Drive account is not connected".to_string());
        };

        let token = AuthToken {
            access_token: creds.access_token.clone(),
            expires_at_ms: creds.expires_at_ms,
        };
        if !token.is_expired(now_ms, TOKEN_REFRESH_LEEWAY_MS) {
            return Ok(token);
        }

        self.refresh_access_token(&creds, now_ms)
    }

    fn sign_out(&self) -> Result<(), String> {
        if let Some(creds) = self.load_stored()? {
            let body = encode_form_params(&[("token", creds.refresh_token.as_str())]).into_bytes();
            let _ = self.http.send(HttpRequest {
                method: HttpMethod::Post,
                url: GOOGLE_REVOKE_ENDPOINT.to_string(),
                headers: vec![(
                    "Content-Type".to_string(),
                    "application/x-www-form-urlencoded".to_string(),
                )],
                body,
            });
        }
        self.credentials.delete_secret(GOOGLE_DRIVE_PROVIDER_ID)
    }
}

const QUERY_ENCODE_SET: &AsciiSet = &NON_ALPHANUMERIC
    .remove(b'-')
    .remove(b'_')
    .remove(b'.')
    .remove(b'~');

pub fn url_encode(input: &str) -> String {
    utf8_percent_encode(input, QUERY_ENCODE_SET).to_string()
}

fn encode_form_params(params: &[(&str, &str)]) -> String {
    params
        .iter()
        .map(|(k, v)| format!("{}={}", url_encode(k), url_encode(v)))
        .collect::<Vec<_>>()
        .join("&")
}
