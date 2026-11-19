use crate::core::domain::PlatformKind;
use serde::{Deserialize, Serialize};

/// Authentication mechanism required by a cloud provider.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum CloudAuthKind {
    OAuthPkce,
    Credentials,
    NativeSystem,
}

/// Static capability descriptor exposed by each cloud provider adapter.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CloudProviderDescriptor {
    pub id: &'static str,
    pub display_name: &'static str,
    pub auth_kind: CloudAuthKind,
    pub supported_platforms: &'static [PlatformKind],
}

impl CloudProviderDescriptor {
    pub fn supports_platform(&self, platform: PlatformKind) -> bool {
        self.supported_platforms.contains(&platform)
    }
}

/// Short-lived bearer/access token returned by a `CloudAuthProvider`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthToken {
    pub access_token: String,
    pub expires_at_ms: i64,
}

impl AuthToken {
    pub fn is_expired(&self, now_ms: i64, leeway_ms: i64) -> bool {
        now_ms.saturating_add(leeway_ms) >= self.expires_at_ms
    }
}

/// Public, non-sensitive view of the current cloud authentication session.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CloudSession {
    pub provider_id: String,
    pub account_label: Option<String>,
    pub connected: bool,
}

/// Port encapsulating cloud authentication (OAuth2 PKCE, token refresh, sign-out).
pub trait CloudAuthProvider: Send + Sync {
    fn descriptor(&self) -> CloudProviderDescriptor;
    fn session(&self) -> Result<CloudSession, String>;
    fn get_valid_access_token(&self, now_ms: i64) -> Result<AuthToken, String>;
    fn sign_out(&self) -> Result<(), String>;
}
