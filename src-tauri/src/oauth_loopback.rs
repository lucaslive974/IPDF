use crate::utils::current_epoch_ms;
use scholarium_core::adapters::cloud::{
    FileCloudCredentialStore, GoogleOAuthConfig, GoogleOAuthPkceAdapter, PkceChallenge,
    UreqHttpTransport,
};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tauri_plugin_opener::OpenerExt;
use tiny_http::{Header, Request, Response, Server};
use url::Url;

const CALLBACK_HTML_TEMPLATE: &str = include_str!("../../assets/oauth_callback.html");

pub fn run_desktop_oauth_loopback(
    app: &tauri::AppHandle,
    credential_store: Arc<FileCloudCredentialStore>,
) -> Result<Arc<GoogleOAuthPkceAdapter>, String> {
    let server = Server::http("127.0.0.1:0").map_err(|e| e.to_string())?;
    let port = server
        .server_addr()
        .to_ip()
        .map(|addr| addr.port())
        .ok_or_else(|| "Failed to resolve loopback server port".to_string())?;
    let redirect_uri = format!("http://127.0.0.1:{port}/oauth/callback");

    let cfg = GoogleOAuthConfig::resolve(None, None, &redirect_uri)?;
    let http = Arc::new(UreqHttpTransport::new());
    let adapter = Arc::new(GoogleOAuthPkceAdapter::new(cfg, credential_store, http));

    let seed_now = current_epoch_ms().to_le_bytes();
    let mut verifier_seed = Vec::with_capacity(32);
    verifier_seed.extend_from_slice(&seed_now);
    verifier_seed.extend_from_slice(&std::process::id().to_le_bytes());
    verifier_seed.extend_from_slice(&port.to_le_bytes());
    verifier_seed.extend_from_slice(b"scholarium-pkce-v1");
    let pkce = PkceChallenge::from_entropy(&verifier_seed, &seed_now);
    let auth_url = adapter.build_authorization_url(&pkce);

    app.opener()
        .open_url(&auth_url, None::<&str>)
        .map_err(|e| format!("Failed to open system browser: {e}"))?;

    let deadline = Instant::now() + Duration::from_secs(180);
    let request = wait_for_callback_request(&server, deadline)?;

    let (code, returned_state, oauth_error) = parse_callback_query(request.url());
    if let Some(err) = oauth_error {
        respond_html(
            request,
            400,
            "Sign-in cancelled",
            "Google sign-in was cancelled or denied. You can close this tab.",
        );
        return Err(format!("Google OAuth error: {err}"));
    }

    if returned_state.as_deref() != Some(pkce.state.as_str()) {
        respond_html(
            request,
            400,
            "Invalid OAuth state",
            "OAuth state verification failed. Please try connecting again from Scholarium.",
        );
        return Err("Google OAuth state mismatch".to_string());
    }

    let Some(auth_code) = code else {
        respond_html(
            request,
            400,
            "Missing authorization code",
            "No authorization code was received. Please try connecting again.",
        );
        return Err("Missing authorization code in Google OAuth callback".to_string());
    };

    adapter.exchange_code(&auth_code, &pkce.code_verifier, None, current_epoch_ms())?;
    respond_html(
        request,
        200,
        "Google Drive Connected",
        "Scholarium is now connected to your Google Drive. You can close this tab and return to the app.",
    );

    Ok(adapter)
}

fn wait_for_callback_request(server: &Server, deadline: Instant) -> Result<Request, String> {
    loop {
        let Some(remaining) = deadline.checked_duration_since(Instant::now()) else {
            return Err("Timed out waiting for Google OAuth sign-in".to_string());
        };
        let req = server
            .recv_timeout(remaining)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "Timed out waiting for Google OAuth sign-in".to_string())?;

        if req.url().starts_with("/oauth/callback") {
            return Ok(req);
        }
        let _ = req.respond(Response::empty(404));
    }
}

fn parse_callback_query(raw_url: &str) -> (Option<String>, Option<String>, Option<String>) {
    let Ok(parsed) = Url::parse(&format!("http://127.0.0.1{raw_url}")) else {
        return (None, None, None);
    };

    let mut code = None;
    let mut state = None;
    let mut error = None;

    for (key, value) in parsed.query_pairs() {
        if value.is_empty() {
            continue;
        }
        match key.as_ref() {
            "code" => code = Some(value.into_owned()),
            "state" => state = Some(value.into_owned()),
            "error" => error = Some(value.into_owned()),
            _ => {}
        }
    }
    (code, state, error)
}

fn respond_html(request: Request, status_code: u16, title: &str, message: &str) {
    let body = CALLBACK_HTML_TEMPLATE
        .replace("{{TITLE}}", title)
        .replace("{{MESSAGE}}", message);
    let mut response = Response::from_string(body).with_status_code(status_code);
    if let Ok(header) = Header::from_bytes(b"Content-Type", b"text/html; charset=utf-8") {
        response = response.with_header(header);
    }
    let _ = request.respond(response);
}
