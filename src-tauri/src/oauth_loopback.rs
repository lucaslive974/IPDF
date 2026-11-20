use crate::utils::current_epoch_ms;
use scholarium_core::adapters::cloud::{
    FileCloudCredentialStore, GoogleOAuthConfig, GoogleOAuthPkceAdapter, PkceChallenge,
    UreqHttpTransport,
};
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tauri_plugin_opener::OpenerExt;

pub fn run_desktop_oauth_loopback(
    app: &tauri::AppHandle,
    credential_store: Arc<FileCloudCredentialStore>,
) -> Result<Arc<GoogleOAuthPkceAdapter>, String> {
    let listener = TcpListener::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();
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

    listener.set_nonblocking(true).map_err(|e| e.to_string())?;
    let deadline = Instant::now() + Duration::from_secs(180);

    let mut stream = loop {
        match listener.accept() {
            Ok((stream, _)) => break stream,
            Err(err) if err.kind() == std::io::ErrorKind::WouldBlock => {
                if Instant::now() >= deadline {
                    return Err("Timed out waiting for Google OAuth sign-in".to_string());
                }
                std::thread::sleep(Duration::from_millis(100));
            }
            Err(err) => return Err(err.to_string()),
        }
    };

    let _ = stream.set_read_timeout(Some(Duration::from_secs(10)));
    let mut buf = [0u8; 4096];
    let n = stream.read(&mut buf).map_err(|e| e.to_string())?;
    let request = String::from_utf8_lossy(&buf[..n]);

    let (code, returned_state, oauth_error) = parse_oauth_callback_request(&request);
    if let Some(err) = oauth_error {
        let _ = write_callback_html(
            &mut stream,
            "400 Bad Request",
            "Sign-in cancelled",
            "Google sign-in was cancelled or denied. You can close this tab.",
        );
        return Err(format!("Google OAuth error: {err}"));
    }

    if returned_state.as_deref() != Some(pkce.state.as_str()) {
        let _ = write_callback_html(
            &mut stream,
            "400 Bad Request",
            "Invalid OAuth state",
            "OAuth state verification failed. Please try connecting again from Scholarium.",
        );
        return Err("Google OAuth state mismatch".to_string());
    }

    let Some(auth_code) = code else {
        let _ = write_callback_html(
            &mut stream,
            "400 Bad Request",
            "Missing authorization code",
            "No authorization code was received. Please try connecting again.",
        );
        return Err("Missing authorization code in Google OAuth callback".to_string());
    };

    adapter.exchange_code(&auth_code, &pkce.code_verifier, None, current_epoch_ms())?;
    let _ = write_callback_html(
        &mut stream,
        "200 OK",
        "Google Drive Connected",
        "Scholarium is now connected to your Google Drive. You can close this tab and return to the app.",
    );

    Ok(adapter)
}

fn parse_oauth_callback_request(request: &str) -> (Option<String>, Option<String>, Option<String>) {
    let first_line = request.lines().next().unwrap_or("");
    let target = first_line.split_whitespace().nth(1).unwrap_or("");
    let query = target.split('?').nth(1).unwrap_or("");
    let mut code = None;
    let mut state = None;
    let mut error = None;

    for pair in query.split('&') {
        let mut parts = pair.splitn(2, '=');
        let key = parts.next().unwrap_or("");
        let val = parts.next().unwrap_or("");
        let decoded = percent_decode(val);
        match key {
            "code" if !decoded.is_empty() => code = Some(decoded),
            "state" if !decoded.is_empty() => state = Some(decoded),
            "error" if !decoded.is_empty() => error = Some(decoded),
            _ => {}
        }
    }
    (code, state, error)
}

fn percent_decode(input: &str) -> String {
    let bytes = input.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Ok(hex) = std::str::from_utf8(&bytes[i + 1..i + 3]) {
                if let Ok(val) = u8::from_str_radix(hex, 16) {
                    out.push(val);
                    i += 3;
                    continue;
                }
            }
        }
        out.push(if bytes[i] == b'+' { b' ' } else { bytes[i] });
        i += 1;
    }
    String::from_utf8_lossy(&out).to_string()
}

fn write_callback_html(
    stream: &mut TcpStream,
    status: &str,
    title: &str,
    message: &str,
) -> std::io::Result<()> {
    let body = format!(
        "<!doctype html><html><head><meta charset='utf-8'><title>{title}</title></head>\
         <body style='font-family:system-ui,sans-serif;background:#111;color:#eee;display:flex;align-items:center;justify-content:center;height:100vh;margin:0'>\
         <div style='max-width:420px;text-align:center;padding:32px;border-radius:12px;background:#1c1c1e;border:1px solid #333'>\
         <h2 style='margin:0 0 12px'>{title}</h2><p style='margin:0;color:#aaa;font-size:14px'>{message}</p>\
         </div></body></html>"
    );
    let response = format!(
        "HTTP/1.1 {status}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
        body.len()
    );
    stream.write_all(response.as_bytes())
}
