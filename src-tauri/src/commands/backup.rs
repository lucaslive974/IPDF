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
use tauri::State;

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
pub fn create_local_backup(
    upload_to_cloud: Option<bool>,
    state: State<'_, Mutex<BackendState>>,
) -> Result<CreateBackupResultDto, String> {
    let guard = state.lock().map_err(|e| e.to_string())?;
    let destination = hybrid_backup_destination(&guard)?;
    let service = BackupService::new();
    let (mut artifact, report) =
        service.create_backup(&*guard.platform_env, &destination, current_epoch_ms())?;

    if upload_to_cloud.unwrap_or(false) && destination.remote().is_some() {
        artifact = destination.upload_local_to_remote(&artifact.id)?;
    }

    let _ = guard.logger.log(LogEntry::new(
        current_epoch_ms(),
        LogLevel::Status,
        "backup",
        format!(
            "Created backup {} ({} books, {} covers)",
            artifact.name, report.books_count, report.covers_count
        ),
    ));

    Ok(CreateBackupResultDto { artifact, report })
}

#[tauri::command]
pub fn list_local_backups(
    state: State<'_, Mutex<BackendState>>,
) -> Result<Vec<BackupArtifact>, String> {
    let guard = state.lock().map_err(|e| e.to_string())?;
    let destination = hybrid_backup_destination(&guard)?;
    destination.list_backups()
}

#[tauri::command]
pub fn restore_local_backup(
    backup_id: String,
    state: State<'_, Mutex<BackendState>>,
) -> Result<BackupReport, String> {
    let mut guard = state.lock().map_err(|e| e.to_string())?;
    let destination = hybrid_backup_destination(&guard)?;

    clear_state_for_restore(&mut guard)?;
    let service = BackupService::new();
    let report = service.restore_backup(&*guard.platform_env, &destination, &backup_id)?;
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
}

#[tauri::command]
pub fn delete_local_backup(
    backup_id: String,
    state: State<'_, Mutex<BackendState>>,
) -> Result<bool, String> {
    let guard = state.lock().map_err(|e| e.to_string())?;
    let destination = hybrid_backup_destination(&guard)?;
    destination.delete_backup(&backup_id)
}

#[tauri::command]
pub fn upload_backup_to_cloud(
    backup_id: String,
    state: State<'_, Mutex<BackendState>>,
) -> Result<BackupArtifact, String> {
    let guard = state.lock().map_err(|e| e.to_string())?;
    let destination = hybrid_backup_destination(&guard)?;
    destination.upload_local_to_remote(&backup_id)
}

#[tauri::command]
pub fn delete_remote_backup(
    backup_id: String,
    state: State<'_, Mutex<BackendState>>,
) -> Result<bool, String> {
    let guard = state.lock().map_err(|e| e.to_string())?;
    let destination = hybrid_backup_destination(&guard)?;
    destination.delete_remote(&backup_id)
}

#[tauri::command]
pub async fn export_local_backup(
    app: tauri::AppHandle,
    backup_id: String,
    state: State<'_, Mutex<BackendState>>,
) -> Result<Option<String>, String> {
    let bytes = {
        let guard = state.lock().map_err(|e| e.to_string())?;
        let destination = hybrid_backup_destination(&guard)?;
        destination.load_backup(&backup_id)?
    };

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
    state: State<'_, Mutex<BackendState>>,
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

    let mut guard = state.lock().map_err(|e| e.to_string())?;

    clear_state_for_restore(&mut guard)?;
    let service = BackupService::new();
    let report = service.restore_from_bytes(&*guard.platform_env, &zip_bytes)?;
    reopen_repositories(&mut guard)?;

    if upload_to_cloud.unwrap_or(false) {
        let destination = hybrid_backup_destination(&guard)?;
        if let Some(remote) = destination.remote() {
            let now_ms = current_epoch_ms();
            let filename = format_backup_filename(
                &sanitize_device_label(
                    &guard.platform_env.device_label(),
                    guard.platform_env.platform_kind().as_str(),
                ),
                guard.platform_env.platform_kind().as_str(),
                now_ms,
            );
            remote.save_backup(&filename, &zip_bytes)?;
        }
    }

    let _ = guard.logger.log(LogEntry::new(
        current_epoch_ms(),
        LogLevel::Status,
        "backup",
        format!(
            "Imported and restored backup from {path_str} ({} books, {} covers)",
            report.books_count, report.covers_count
        ),
    ));

    Ok(Some(report))
}
