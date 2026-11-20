use crate::state::BackendState;
use crate::utils::current_epoch_ms;
use scholarium_core::adapters::backup::{
    CloudBackupDestination, HybridBackupDestination, LocalBackupDestination,
};
use scholarium_core::adapters::configuration::SqliteConfigurationStore;
use scholarium_core::adapters::persistence::{SqliteBookRepository, SqliteHighlightRepository};
use scholarium_core::core::ports::{
    format_backup_filename, sanitize_device_label, BackupArtifact, BackupDestination, BackupReport,
    BookRepository, ConfigurationStore, HighlightRepository, LogEntry, LogLevel, LogService,
    StorageProvider,
};
use scholarium_core::core::services::{BackupService, LibraryManager};
use serde::Serialize;
use std::sync::{Arc, Mutex};
use tauri::{Manager, State};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateBackupResultDto {
    pub artifact: BackupArtifact,
    pub report: BackupReport,
}

fn hybrid_backup_destination(
    state: &BackendState,
) -> Result<HybridBackupDestination<LocalBackupDestination>, String> {
    let backup_dir = state.platform_env.backups_dir()?;
    let local = LocalBackupDestination::new(backup_dir);
    #[cfg(feature = "cloud-sync")]
    let remote = state
        .storage
        .remote()
        .map(|cloud| Arc::new(CloudBackupDestination::new(cloud)) as Arc<dyn BackupDestination>);
    #[cfg(not(feature = "cloud-sync"))]
    let remote: Option<Arc<dyn BackupDestination>> = {
        let _ = CloudBackupDestination::new;
        None
    };
    Ok(HybridBackupDestination::new(local, remote))
}

fn clear_state_for_restore(guard: &mut BackendState) -> Result<(), String> {
    guard.presence_manager.clear_all_presence();
    guard.highlight_repo.clear()?;
    guard.library.book_repo_mut().clear()?;
    guard.storage.clear()?;
    guard.config_store.clear()?;
    Ok(())
}

fn reopen_repositories(guard: &mut BackendState) -> Result<(), String> {
    guard.highlight_repo = SqliteHighlightRepository::open_for_platform(&*guard.platform_env)?;
    let book_repo = SqliteBookRepository::open_for_platform(&*guard.platform_env)?;
    guard.library = LibraryManager::new_with_repo(guard.storage.clone(), book_repo);
    let _ = guard.library.initialize();
    guard.config_store = SqliteConfigurationStore::for_platform(&*guard.platform_env)?;
    Ok(())
}

#[tauri::command]
pub async fn create_local_backup(
    app: tauri::AppHandle,
    upload_to_cloud: Option<bool>,
) -> Result<CreateBackupResultDto, String> {
    let should_upload = upload_to_cloud.unwrap_or(false);
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<Mutex<BackendState>>();
        let (destination, platform_env) = {
            let guard = state.lock().map_err(|e| e.to_string())?;
            (
                hybrid_backup_destination(&guard)?,
                guard.platform_env.clone(),
            )
        };

        let service = BackupService::new();
        let (mut artifact, report) =
            service.create_backup(&*platform_env, &destination, current_epoch_ms())?;

        if let Ok(guard) = state.lock() {
            let _ = guard.logger.log(LogEntry::new(
                current_epoch_ms(),
                LogLevel::Status,
                "backup",
                format!(
                    "Created backup {} ({} books, {} covers)",
                    artifact.name, report.books_count, report.covers_count
                ),
            ));
        }

        if should_upload && destination.remote().is_some() {
            artifact = destination.upload_local_to_remote(&artifact.id)?;
        }

        Ok(CreateBackupResultDto { artifact, report })
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn list_local_backups(
    state: State<'_, Mutex<BackendState>>,
) -> Result<Vec<BackupArtifact>, String> {
    let destination = {
        let guard = state.lock().map_err(|e| e.to_string())?;
        hybrid_backup_destination(&guard)?
    };
    tauri::async_runtime::spawn_blocking(move || destination.list_backups())
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn restore_local_backup(
    app: tauri::AppHandle,
    backup_id: String,
    state: State<'_, Mutex<BackendState>>,
) -> Result<BackupReport, String> {
    let destination = {
        let guard = state.lock().map_err(|e| e.to_string())?;
        hybrid_backup_destination(&guard)?
    };

    tauri::async_runtime::spawn_blocking(move || {
        let zip_bytes = destination.load_backup(&backup_id)?;
        let app_state = app.state::<Mutex<BackendState>>();
        let mut guard = app_state.lock().map_err(|e| e.to_string())?;

        clear_state_for_restore(&mut guard)?;
        let service = BackupService::new();
        let report = service.restore_from_bytes(&*guard.platform_env, &zip_bytes)?;
        reopen_repositories(&mut guard)?;

        let _ = guard.logger.log(LogEntry::new(
            current_epoch_ms(),
            LogLevel::Status,
            "backup",
            format!(
                "Restored backup {backup_id} ({} books, {} covers)",
                report.books_count, report.covers_count
            ),
        ));

        Ok(report)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn delete_local_backup(
    backup_id: String,
    state: State<'_, Mutex<BackendState>>,
) -> Result<bool, String> {
    let destination = {
        let guard = state.lock().map_err(|e| e.to_string())?;
        hybrid_backup_destination(&guard)?
    };
    tauri::async_runtime::spawn_blocking(move || destination.delete_backup(&backup_id))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn upload_backup_to_cloud(
    backup_id: String,
    state: State<'_, Mutex<BackendState>>,
) -> Result<BackupArtifact, String> {
    let destination = {
        let guard = state.lock().map_err(|e| e.to_string())?;
        hybrid_backup_destination(&guard)?
    };
    tauri::async_runtime::spawn_blocking(move || destination.upload_local_to_remote(&backup_id))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn delete_remote_backup(
    backup_id: String,
    state: State<'_, Mutex<BackendState>>,
) -> Result<bool, String> {
    let destination = {
        let guard = state.lock().map_err(|e| e.to_string())?;
        hybrid_backup_destination(&guard)?
    };
    tauri::async_runtime::spawn_blocking(move || destination.delete_remote(&backup_id))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn export_local_backup(
    app: tauri::AppHandle,
    backup_id: String,
    state: State<'_, Mutex<BackendState>>,
) -> Result<Option<String>, String> {
    let destination = {
        let guard = state.lock().map_err(|e| e.to_string())?;
        hybrid_backup_destination(&guard)?
    };
    let id_for_load = backup_id.clone();
    let bytes = tauri::async_runtime::spawn_blocking(move || destination.load_backup(&id_for_load))
        .await
        .map_err(|e| e.to_string())??;

    let Some(file_path) = crate::utils::save_file_dialog(
        &app,
        "Export Backup",
        "Scholarium Backup (*.zip)",
        &["zip"],
        &backup_id,
    )
    .await?
    else {
        return Ok(None);
    };

    let path_str = file_path.to_string();
    crate::utils::write_dialog_file_bytes(&app, file_path, bytes).await?;

    if let Ok(guard) = state.lock() {
        let _ = guard.logger.log(LogEntry::new(
            current_epoch_ms(),
            LogLevel::Status,
            "backup",
            format!("Exported backup {backup_id} to {path_str}"),
        ));
    }

    Ok(Some(path_str))
}

#[tauri::command]
pub async fn import_and_restore_backup(
    app: tauri::AppHandle,
    upload_to_cloud: Option<bool>,
) -> Result<Option<BackupReport>, String> {
    let Some(file_path) = crate::utils::pick_file_dialog(
        &app,
        "Import & Restore Backup",
        "Scholarium Backup (*.zip)",
        &["zip"],
    )
    .await?
    else {
        return Ok(None);
    };

    let path_str = file_path.to_string();
    let zip_bytes = crate::utils::read_dialog_file_bytes(&app, file_path).await?;
    let should_upload = upload_to_cloud.unwrap_or(false);

    let report = tauri::async_runtime::spawn_blocking(move || -> Result<BackupReport, String> {
        let state = app.state::<Mutex<BackendState>>();
        let (destination, filename, report) = {
            let mut guard = state.lock().map_err(|e| e.to_string())?;
            clear_state_for_restore(&mut guard)?;
            let service = BackupService::new();
            let report = service.restore_from_bytes(&*guard.platform_env, &zip_bytes)?;
            reopen_repositories(&mut guard)?;

            let _ = guard.logger.log(LogEntry::new(
                current_epoch_ms(),
                LogLevel::Status,
                "backup",
                format!(
                    "Imported and restored backup from {path_str} ({} books, {} covers)",
                    report.books_count, report.covers_count
                ),
            ));

            let destination = hybrid_backup_destination(&guard)?;
            let filename = format_backup_filename(
                &sanitize_device_label(
                    &guard.platform_env.device_label(),
                    guard.platform_env.platform_kind().as_str(),
                ),
                guard.platform_env.platform_kind().as_str(),
                current_epoch_ms(),
            );
            (destination, filename, report)
        };

        if should_upload {
            if let Some(remote) = destination.remote() {
                remote.save_backup(&filename, &zip_bytes)?;
            }
        }

        Ok(report)
    })
    .await
    .map_err(|e| e.to_string())??;

    Ok(Some(report))
}
