use crate::state::BackendState;
use crate::utils::current_epoch_ms;
use scholarium_core::adapters::configuration::SqliteConfigurationStore;
use scholarium_core::adapters::persistence::{SqliteBookRepository, SqliteHighlightRepository};
use scholarium_core::core::domain::{PlatformKind, SyncReport};
use scholarium_core::core::ports::{
    CloudAuthKind, CloudAuthProvider, ConfigurationStore, LogEntry, LogLevel, LogService,
};
use scholarium_core::core::services::{CloudSyncEngine, LocalSyncCursor};
use serde::Serialize;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{Emitter, Manager};

pub const SYNC_STATUS_EVENT: &str = "sync:status";
pub const SYNC_INTERVAL_CONFIG_KEY: &str = "cloud_sync_interval_secs";
pub const DEFAULT_SYNC_INTERVAL_SECS: u64 = 300;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CloudProviderDto {
    pub id: String,
    pub display_name: String,
    pub auth_kind: CloudAuthKind,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CloudSyncStatusDto {
    pub state: String,
    pub connected: bool,
    pub provider_id: Option<String>,
    pub account_label: Option<String>,
    pub interval_secs: u64,
    pub last_synced_at_ms: Option<i64>,
    pub last_revision: u64,
    pub last_pulled_books: usize,
    pub last_pushed_books: usize,
    pub last_error: Option<String>,
    pub available_providers: Vec<CloudProviderDto>,
}

/// Backend-owned synchronization scheduler handle.
///
/// Manages cheap periodic ETag polling, write debouncing (`mark_dirty`), single-flight
/// concurrency protection, and reactive `sync:status` event emission to the frontend.
#[derive(Clone)]
pub struct SyncSchedulerHandle {
    interval_secs: Arc<AtomicU64>,
    dirty: Arc<AtomicBool>,
    syncing: Arc<AtomicBool>,
    last_status: Arc<Mutex<CloudSyncStatusDto>>,
}

impl SyncSchedulerHandle {
    pub fn new(
        initial_interval_secs: u64,
        initial_status: CloudSyncStatusDto,
        dirty: Arc<AtomicBool>,
    ) -> Self {
        Self {
            interval_secs: Arc::new(AtomicU64::new(initial_interval_secs)),
            dirty,
            syncing: Arc::new(AtomicBool::new(false)),
            last_status: Arc::new(Mutex::new(initial_status)),
        }
    }

    pub fn mark_dirty(&self) {
        self.dirty.store(true, Ordering::SeqCst);
    }

    pub fn interval_secs(&self) -> u64 {
        self.interval_secs.load(Ordering::SeqCst)
    }

    pub fn set_interval_secs(&self, secs: u64) {
        self.interval_secs.store(secs, Ordering::SeqCst);
        if let Ok(mut status) = self.last_status.lock() {
            status.interval_secs = secs;
        }
    }

    pub fn snapshot(&self, backend: &BackendState) -> CloudSyncStatusDto {
        let mut dto = self
            .last_status
            .lock()
            .map(|s| s.clone())
            .unwrap_or_else(|_| empty_status(self.interval_secs(), backend));
        refresh_connection_fields(&mut dto, backend, self.interval_secs());
        dto
    }

    pub fn emit_current(&self, app: &tauri::AppHandle, backend: &BackendState) {
        let dto = self.snapshot(backend);
        if let Ok(mut guard) = self.last_status.lock() {
            *guard = dto.clone();
        }
        let _ = app.emit(SYNC_STATUS_EVENT, &dto);
    }

    pub fn emit_error(&self, app: &tauri::AppHandle, backend: &BackendState, message: &str) {
        self.update_and_emit(app, backend, |s| {
            s.state = "error".to_string();
            s.last_error = Some(message.to_string());
        });
    }

    /// Starts the backend-owned background polling/debounce loop.
    pub fn spawn_background_loop(&self, app: tauri::AppHandle) {
        let handle = self.clone();
        std::thread::spawn(move || {
            let mut last_poll = Instant::now();
            loop {
                std::thread::sleep(Duration::from_secs(DEFAULT_SYNC_INTERVAL_SECS));

                let is_dirty = handle.dirty.swap(false, Ordering::SeqCst);
                if is_dirty {
                    let _ = handle.run_sync_now(&app);
                    last_poll = Instant::now();
                    continue;
                }

                let interval = handle.interval_secs();
                if interval > 0 && last_poll.elapsed() >= Duration::from_secs(interval) {
                    let _ = handle.check_and_sync_if_remote_changed(&app);
                    last_poll = Instant::now();
                }
            }
        });
    }

    /// Cheap ETag check (`HEAD sync-manifest.json`); only runs full sync when remote ETag differs.
    pub fn check_and_sync_if_remote_changed(
        &self,
        app: &tauri::AppHandle,
    ) -> Result<Option<SyncReport>, String> {
        let state = app
            .try_state::<Mutex<BackendState>>()
            .ok_or_else(|| "Backend state unavailable".to_string())?;

        let (cloud, db_path) = {
            let guard = state.lock().map_err(|e| e.to_string())?;
            let Some(cloud) = guard.storage.remote() else {
                return Ok(None);
            };
            let db_path = guard.platform_env.default_database_path()?;
            (cloud, db_path)
        };

        let should_sync = {
            let config_store = SqliteConfigurationStore::open_file(&db_path)?;
            let engine = CloudSyncEngine::new();
            engine.check_remote_changed(&config_store, cloud.as_ref())?
        };

        if should_sync {
            self.run_sync_now(app).map(Some)
        } else {
            Ok(None)
        }
    }

    /// Executes a single-flight full cloud synchronization cycle and emits `sync:status`.
    pub fn run_sync_now(&self, app: &tauri::AppHandle) -> Result<SyncReport, String> {
        if self.syncing.swap(true, Ordering::SeqCst) {
            return Err("Cloud synchronization is already in progress".to_string());
        }

        let result = self.execute_sync_guarded(app);
        self.syncing.store(false, Ordering::SeqCst);
        result
    }

    fn execute_sync_guarded(&self, app: &tauri::AppHandle) -> Result<SyncReport, String> {
        let state = app
            .try_state::<Mutex<BackendState>>()
            .ok_or_else(|| "Backend state unavailable".to_string())?;

        let (cloud, mut storage, db_path) = {
            let guard = state.lock().map_err(|e| e.to_string())?;
            let Some(cloud) = guard.storage.remote() else {
                return Err("No cloud provider connected".to_string());
            };
            let db_path = guard.platform_env.default_database_path()?;
            self.update_and_emit(app, &guard, |s| {
                s.state = "syncing".to_string();
                s.last_error = None;
            });
            (cloud, guard.storage.clone(), db_path)
        };

        let now_ms = current_epoch_ms();
        let sync_result = (|| -> Result<SyncReport, String> {
            let mut book_repo = SqliteBookRepository::open_file(&db_path)?;
            let mut highlight_repo = SqliteHighlightRepository::open_file(&db_path)?;
            let mut config_store = SqliteConfigurationStore::open_file(&db_path)?;
            let engine = CloudSyncEngine::new();
            engine.sync_once(
                &mut book_repo,
                &mut highlight_repo,
                &mut storage,
                &mut config_store,
                cloud.as_ref(),
                now_ms,
            )
        })();

        if let Ok(guard) = state.lock() {
            match &sync_result {
                Ok(report) => {
                    let _ = guard.logger.log(LogEntry::new(
                        now_ms,
                        LogLevel::Status,
                        "cloud_sync",
                        format!(
                            "Cloud sync completed (rev {}, pulled {}, pushed {}, blobs {})",
                            report.revision,
                            report.pulled_books,
                            report.pushed_books,
                            report.uploaded_blobs
                        ),
                    ));
                    self.update_and_emit(app, &guard, |s| {
                        s.state = "synced".to_string();
                        s.last_synced_at_ms = Some(report.synced_at_ms);
                        s.last_revision = report.revision;
                        s.last_pulled_books = report.pulled_books;
                        s.last_pushed_books = report.pushed_books;
                        s.last_error = None;
                    });
                }
                Err(err) => {
                    let _ = guard.logger.log(LogEntry::new(
                        now_ms,
                        LogLevel::Error,
                        "cloud_sync",
                        format!("Cloud sync failed: {err}"),
                    ));
                    self.update_and_emit(app, &guard, |s| {
                        s.state = "error".to_string();
                        s.last_error = Some(err.clone());
                    });
                }
            }
        }

        sync_result
    }

    fn update_and_emit<F>(&self, app: &tauri::AppHandle, backend: &BackendState, mutate: F)
    where
        F: FnOnce(&mut CloudSyncStatusDto),
    {
        if let Ok(mut status) = self.last_status.lock() {
            refresh_connection_fields(&mut status, backend, self.interval_secs());
            mutate(&mut status);
            let _ = app.emit(SYNC_STATUS_EVENT, &*status);
        }
    }
}

pub fn load_configured_interval_secs<C: ConfigurationStore>(config: &C) -> u64 {
    config
        .get(SYNC_INTERVAL_CONFIG_KEY)
        .ok()
        .flatten()
        .and_then(|v| v.parse::<u64>().ok())
        .unwrap_or(DEFAULT_SYNC_INTERVAL_SECS)
}

pub fn available_providers_for_platform(platform: PlatformKind) -> Vec<CloudProviderDto> {
    let all = [scholarium_core::core::ports::CloudProviderDescriptor {
        id: scholarium_core::adapters::cloud::GOOGLE_DRIVE_PROVIDER_ID,
        display_name: "Google Drive",
        auth_kind: CloudAuthKind::OAuthPkce,
        supported_platforms: &[
            PlatformKind::Linux,
            PlatformKind::Windows,
            PlatformKind::Android,
            PlatformKind::Ios,
        ],
    }];

    all.into_iter()
        .filter(|d| d.supports_platform(platform))
        .map(|d| CloudProviderDto {
            id: d.id.to_string(),
            display_name: d.display_name.to_string(),
            auth_kind: d.auth_kind,
        })
        .collect()
}

pub fn empty_status(interval_secs: u64, backend: &BackendState) -> CloudSyncStatusDto {
    let cursor = LocalSyncCursor::load(&backend.config_store).unwrap_or_default();
    let initial_state = if cursor.last_revision > 0 && backend.cloud_sync.cloud_auth.is_some() {
        "synced".to_string()
    } else {
        "idle".to_string()
    };
    let mut dto = CloudSyncStatusDto {
        state: initial_state,
        connected: false,
        provider_id: None,
        account_label: None,
        interval_secs,
        last_synced_at_ms: cursor.last_synced_at_ms,
        last_revision: cursor.last_revision,
        last_pulled_books: 0,
        last_pushed_books: 0,
        last_error: None,
        available_providers: available_providers_for_platform(backend.platform_env.platform_kind()),
    };
    refresh_connection_fields(&mut dto, backend, interval_secs);
    dto
}

fn refresh_connection_fields(
    dto: &mut CloudSyncStatusDto,
    backend: &BackendState,
    interval_secs: u64,
) {
    dto.interval_secs = interval_secs;
    dto.available_providers =
        available_providers_for_platform(backend.platform_env.platform_kind());
    if let Some(auth) = &backend.cloud_sync.cloud_auth {
        if let Ok(session) = auth.session() {
            dto.connected = session.connected;
            dto.provider_id = if session.connected {
                Some(session.provider_id)
            } else {
                None
            };
            dto.account_label = session.account_label;
            return;
        }
    }
    dto.connected = false;
    dto.provider_id = None;
    dto.account_label = None;
}
