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

    let app_handle = app.clone();
    let adapter = tauri::async_runtime::spawn_blocking(move || {
        crate::oauth_loopback::run_desktop_oauth_loopback(&app_handle, credential_store)
    })
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

    Ok(status)
}

#[cfg(any(target_os = "android", target_os = "ios"))]
#[tauri::command]
pub async fn connect_google_drive() -> Result<CloudSyncStatusDto, String> {
    Err("Automatic loopback OAuth is only supported on desktop".to_string())
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
