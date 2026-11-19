use crate::state::{BackendState, PendingGoogleOAuth};
use crate::sync_scheduler::{
    available_providers_for_platform, CloudProviderDto, CloudSyncStatusDto, SyncSchedulerHandle,
    SYNC_INTERVAL_CONFIG_KEY,
};
use crate::utils::current_epoch_ms;
use scholarium_core::adapters::cloud::{
    GoogleDriveAppDataAdapter, GoogleOAuthConfig, GoogleOAuthPkceAdapter, PkceChallenge,
    UreqHttpTransport,
};
use scholarium_core::core::domain::{BookAvailability, SyncReport};
use scholarium_core::core::ports::{
    BookRepository, CloudAuthProvider, CloudStorageProvider, ConfigurationStore,
};
use scholarium_core::core::services::LocalSyncCursor;
use serde::Serialize;
use std::collections::BTreeMap;
use std::sync::{Arc, Mutex};
use tauri::State;

const GOOGLE_CLIENT_ID_CONFIG_KEY: &str = "google_oauth_client_id";
const DEFAULT_OAUTH_REDIRECT_URI: &str = "http://127.0.0.1:42813/oauth/callback";

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OAuthStartResultDto {
    pub auth_url: String,
    pub state: String,
    pub redirect_uri: String,
}

#[tauri::command]
pub fn list_cloud_providers(
    state: State<'_, Mutex<BackendState>>,
) -> Result<Vec<CloudProviderDto>, String> {
    let guard = state.lock().map_err(|e| e.to_string())?;
    Ok(available_providers_for_platform(
        guard.platform_env.platform_kind(),
    ))
}

#[tauri::command]
pub fn get_cloud_sync_status(
    state: State<'_, Mutex<BackendState>>,
    scheduler: State<'_, SyncSchedulerHandle>,
) -> Result<CloudSyncStatusDto, String> {
    let guard = state.lock().map_err(|e| e.to_string())?;
    Ok(scheduler.snapshot(&guard))
}

#[tauri::command]
pub fn begin_google_oauth(
    client_id_override: Option<String>,
    redirect_uri: Option<String>,
    state: State<'_, Mutex<BackendState>>,
) -> Result<OAuthStartResultDto, String> {
    let mut guard = state.lock().map_err(|e| e.to_string())?;

    let effective_override = match client_id_override {
        Some(ref id) if !id.trim().is_empty() => {
            let trimmed = id.trim().to_string();
            let _ = guard
                .config_store
                .set(GOOGLE_CLIENT_ID_CONFIG_KEY, &trimmed);
            Some(trimmed)
        }
        _ => guard
            .config_store
            .get(GOOGLE_CLIENT_ID_CONFIG_KEY)
            .ok()
            .flatten(),
    };

    let resolved_redirect = redirect_uri
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| DEFAULT_OAUTH_REDIRECT_URI.to_string());

    let cfg = GoogleOAuthConfig::resolve(effective_override, None, &resolved_redirect)?;
    let http = Arc::new(UreqHttpTransport::new());
    let adapter = Arc::new(GoogleOAuthPkceAdapter::new(
        cfg,
        guard.credential_store.clone(),
        http,
    ));

    let seed_now = current_epoch_ms().to_le_bytes();
    let mut verifier_seed = Vec::with_capacity(32);
    verifier_seed.extend_from_slice(&seed_now);
    verifier_seed.extend_from_slice(&std::process::id().to_le_bytes());
    verifier_seed.extend_from_slice(b"scholarium-pkce-v1");
    let pkce = PkceChallenge::from_entropy(&verifier_seed, &seed_now);

    let auth_url = adapter.build_authorization_url(&pkce);
    let state_token = pkce.state.clone();
    guard.pending_oauth = Some(PendingGoogleOAuth { pkce, adapter });

    Ok(OAuthStartResultDto {
        auth_url,
        state: state_token,
        redirect_uri: resolved_redirect,
    })
}

#[tauri::command]
pub async fn complete_google_oauth(
    code: String,
    account_label: Option<String>,
    app: tauri::AppHandle,
    state: State<'_, Mutex<BackendState>>,
    scheduler: State<'_, SyncSchedulerHandle>,
) -> Result<CloudSyncStatusDto, String> {
    let pending = {
        let mut guard = state.lock().map_err(|e| e.to_string())?;
        guard
            .pending_oauth
            .take()
            .ok_or_else(|| "No pending Google OAuth flow".to_string())?
    };

    let adapter = pending.adapter.clone();
    let verifier = pending.pkce.code_verifier.clone();
    let now_ms = current_epoch_ms();

    tauri::async_runtime::spawn_blocking(move || {
        adapter.exchange_code(&code, &verifier, account_label, now_ms)
    })
    .await
    .map_err(|e| e.to_string())??;

    let http = Arc::new(UreqHttpTransport::new());
    let drive_storage: Arc<dyn CloudStorageProvider> = Arc::new(GoogleDriveAppDataAdapter::new(
        pending.adapter.clone(),
        http,
    ));

    let status = {
        let mut guard = state.lock().map_err(|e| e.to_string())?;
        guard.cloud_auth = Some(pending.adapter);
        guard.storage.set_remote(Some(drive_storage));
        scheduler.mark_dirty();
        scheduler.emit_current(&app, &guard);
        scheduler.snapshot(&guard)
    };

    Ok(status)
}

#[cfg(not(any(target_os = "android", target_os = "ios")))]
#[tauri::command]
pub async fn connect_google_drive(
    app: tauri::AppHandle,
    state: State<'_, Mutex<BackendState>>,
    scheduler: State<'_, SyncSchedulerHandle>,
) -> Result<CloudSyncStatusDto, String> {
    let credential_store = {
        let guard = state.lock().map_err(|e| e.to_string())?;
        guard.credential_store.clone()
    };

    let (adapter, code) =
        tauri::async_runtime::spawn_blocking(move || run_desktop_oauth_loopback(credential_store))
            .await
            .map_err(|e| e.to_string())??;

    let http = Arc::new(UreqHttpTransport::new());
    let drive_storage: Arc<dyn CloudStorageProvider> =
        Arc::new(GoogleDriveAppDataAdapter::new(adapter.clone(), http));

    let status = {
        let mut guard = state.lock().map_err(|e| e.to_string())?;
        guard.pending_oauth = None;
        guard.cloud_auth = Some(adapter);
        guard.storage.set_remote(Some(drive_storage));
        scheduler.mark_dirty();
        scheduler.emit_current(&app, &guard);
        scheduler.snapshot(&guard)
    };

    let _ = code;
    Ok(status)
}

#[cfg(any(target_os = "android", target_os = "ios"))]
#[tauri::command]
pub async fn connect_google_drive() -> Result<CloudSyncStatusDto, String> {
    Err("Automatic loopback OAuth is only supported on desktop".to_string())
}

#[cfg(not(any(target_os = "android", target_os = "ios")))]
fn run_desktop_oauth_loopback(
    credential_store: Arc<scholarium_core::adapters::cloud::FileCloudCredentialStore>,
) -> Result<(Arc<GoogleOAuthPkceAdapter>, String), String> {
    use std::io::Read;
    use std::net::TcpListener;
    use std::time::{Duration, Instant};

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

    open_in_system_browser(&auth_url)?;

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

    Ok((adapter, auth_code))
}

#[cfg(not(any(target_os = "android", target_os = "ios")))]
fn open_in_system_browser(url: &str) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    let status = std::process::Command::new("xdg-open").arg(url).spawn();
    #[cfg(target_os = "macos")]
    let status = std::process::Command::new("open").arg(url).spawn();
    #[cfg(target_os = "windows")]
    let status = std::process::Command::new("cmd")
        .args(["/C", "start", "", url])
        .spawn();

    status
        .map(|_| ())
        .map_err(|e| format!("Failed to open system browser: {e}"))
}

#[cfg(not(any(target_os = "android", target_os = "ios")))]
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

#[cfg(not(any(target_os = "android", target_os = "ios")))]
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

#[cfg(not(any(target_os = "android", target_os = "ios")))]
fn write_callback_html(
    stream: &mut std::net::TcpStream,
    status: &str,
    title: &str,
    message: &str,
) -> std::io::Result<()> {
    use std::io::Write;
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

#[tauri::command]
pub async fn disconnect_cloud_provider(
    app: tauri::AppHandle,
    state: State<'_, Mutex<BackendState>>,
    scheduler: State<'_, SyncSchedulerHandle>,
) -> Result<CloudSyncStatusDto, String> {
    let auth_opt = {
        let mut guard = state.lock().map_err(|e| e.to_string())?;
        guard.storage.set_remote(None);
        guard.pending_oauth = None;
        guard.cloud_auth.take()
    };

    if let Some(auth) = auth_opt {
        let _ = tauri::async_runtime::spawn_blocking(move || auth.sign_out()).await;
    }

    let guard = state.lock().map_err(|e| e.to_string())?;
    scheduler.emit_current(&app, &guard);
    Ok(scheduler.snapshot(&guard))
}

#[tauri::command]
pub async fn trigger_cloud_sync(
    app: tauri::AppHandle,
    scheduler: State<'_, SyncSchedulerHandle>,
) -> Result<SyncReport, String> {
    let handle = scheduler.inner().clone();
    let app_clone = app.clone();
    tauri::async_runtime::spawn_blocking(move || handle.run_sync_now(&app_clone))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn notify_app_resumed(
    app: tauri::AppHandle,
    scheduler: State<'_, SyncSchedulerHandle>,
) -> Result<Option<SyncReport>, String> {
    let handle = scheduler.inner().clone();
    let app_clone = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        handle.check_and_sync_if_remote_changed(&app_clone)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn set_cloud_sync_interval(
    interval_secs: u64,
    app: tauri::AppHandle,
    state: State<'_, Mutex<BackendState>>,
    scheduler: State<'_, SyncSchedulerHandle>,
) -> Result<CloudSyncStatusDto, String> {
    let mut guard = state.lock().map_err(|e| e.to_string())?;
    guard
        .config_store
        .set(SYNC_INTERVAL_CONFIG_KEY, &interval_secs.to_string())?;
    scheduler.set_interval_secs(interval_secs);
    scheduler.emit_current(&app, &guard);
    Ok(scheduler.snapshot(&guard))
}

#[tauri::command]
pub fn list_book_availabilities(
    state: State<'_, Mutex<BackendState>>,
) -> Result<BTreeMap<String, BookAvailability>, String> {
    let mut guard = state.lock().map_err(|e| e.to_string())?;
    let books = guard.library.list_books()?;
    let mut map = BTreeMap::new();
    for book in books {
        let availability = guard.storage.book_availability(&book.book_hash)?;
        map.insert(book.book_hash, availability);
    }
    Ok(map)
}

#[tauri::command]
pub async fn download_remote_book(
    book_hash: String,
    state: State<'_, Mutex<BackendState>>,
) -> Result<bool, String> {
    let (mut storage, format) = {
        let guard = state.lock().map_err(|e| e.to_string())?;
        let book = guard
            .library
            .book_repo()
            .find_book_by_hash(&book_hash)?
            .ok_or_else(|| format!("Book not found: {book_hash}"))?;
        (guard.storage.clone(), book.format)
    };

    tauri::async_runtime::spawn_blocking(move || storage.ensure_book_downloaded(&book_hash, format))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn evict_local_book(
    book_hash: String,
    state: State<'_, Mutex<BackendState>>,
) -> Result<bool, String> {
    let mut guard = state.lock().map_err(|e| e.to_string())?;
    guard.storage.evict_local_book(&book_hash)
}

#[tauri::command]
pub async fn clear_cloud_sync_data(state: State<'_, Mutex<BackendState>>) -> Result<usize, String> {
    let cloud = {
        let guard = state.lock().map_err(|e| e.to_string())?;
        guard
            .storage
            .remote()
            .ok_or_else(|| "No cloud provider connected".to_string())?
    };

    let deleted = tauri::async_runtime::spawn_blocking(move || -> Result<usize, String> {
        let objects = cloud.list_prefix("").map_err(|e| e.to_string())?;
        let mut count = 0usize;
        for obj in objects {
            cloud
                .delete_unconditional(&obj.path)
                .map_err(|e| e.to_string())?;
            count += 1;
        }
        Ok(count)
    })
    .await
    .map_err(|e| e.to_string())??;

    let mut guard = state.lock().map_err(|e| e.to_string())?;
    LocalSyncCursor::default().save(&mut guard.config_store)?;
    Ok(deleted)
}
