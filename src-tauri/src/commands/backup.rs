use crate::state::BackendState;
use crate::utils::current_epoch_ms;
use scholarium_core::adapters::backup::LocalBackupDestination;
use scholarium_core::adapters::configuration::SqliteConfigurationStore;
use scholarium_core::adapters::persistence::{SqliteBookRepository, SqliteHighlightRepository};
use scholarium_core::core::ports::{
    BackupArtifact, BackupDestination, BackupReport, BookRepository, ConfigurationStore,
    HighlightRepository, LogEntry, LogLevel, LogService, StorageProvider,
};
use scholarium_core::core::services::{BackupService, LibraryManager};
use serde::Serialize;
use std::sync::Mutex;
use tauri::State;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateBackupResultDto {
    pub artifact: BackupArtifact,
    pub report: BackupReport,
}

fn default_backup_destination(state: &BackendState) -> Result<LocalBackupDestination, String> {
    let backup_dir = state.platform_env.backups_dir()?;
    Ok(LocalBackupDestination::new(backup_dir))
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
    state: State<'_, Mutex<BackendState>>,
) -> Result<CreateBackupResultDto, String> {
    let guard = state.lock().map_err(|e| e.to_string())?;
    let destination = default_backup_destination(&guard)?;
    let service = BackupService::new();
    let (artifact, report) =
        service.create_backup(&*guard.platform_env, &destination, current_epoch_ms())?;

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
    let destination = default_backup_destination(&guard)?;
    destination.list_backups()
}

#[tauri::command]
pub fn restore_local_backup(
    backup_id: String,
    state: State<'_, Mutex<BackendState>>,
) -> Result<BackupReport, String> {
    let mut guard = state.lock().map_err(|e| e.to_string())?;
    let destination = default_backup_destination(&guard)?;

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
    let destination = default_backup_destination(&guard)?;
    destination.delete_backup(&backup_id)
}

#[cfg(not(any(target_os = "android", target_os = "ios")))]
#[tauri::command]
pub async fn export_local_backup(
    backup_id: String,
    state: State<'_, Mutex<BackendState>>,
) -> Result<Option<String>, String> {
    let bytes = {
        let guard = state.lock().map_err(|e| e.to_string())?;
        let destination = default_backup_destination(&guard)?;
        destination.load_backup(&backup_id)?
    };

    let handle = rfd::AsyncFileDialog::new()
        .add_filter("Scholarium Backup (*.zip)", &["zip"])
        .set_file_name(&backup_id)
        .set_title("Export Backup")
        .save_file()
        .await;

    let Some(file_handle) = handle else {
        return Ok(None);
    };

    let target_path = file_handle.path().to_path_buf();
    std::fs::write(&target_path, &bytes).map_err(|e| e.to_string())?;
    let path_str = target_path.to_string_lossy().to_string();

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

#[cfg(any(target_os = "android", target_os = "ios"))]
#[tauri::command]
pub async fn export_local_backup() -> Result<Option<String>, String> {
    Err("Native desktop file dialog is not supported on mobile".to_string())
}

#[cfg(not(any(target_os = "android", target_os = "ios")))]
#[tauri::command]
pub async fn import_and_restore_backup(
    state: State<'_, Mutex<BackendState>>,
) -> Result<Option<BackupReport>, String> {
    let handle = rfd::AsyncFileDialog::new()
        .add_filter("Scholarium Backup (*.zip)", &["zip"])
        .set_title("Import & Restore Backup")
        .pick_file()
        .await;

    let Some(file_handle) = handle else {
        return Ok(None);
    };

    let zip_bytes = std::fs::read(file_handle.path()).map_err(|e| e.to_string())?;
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
            "Imported and restored backup from {} ({} books, {} covers)",
            file_handle.path().display(),
            report.books_count,
            report.covers_count
        ),
    ));

    Ok(Some(report))
}

#[cfg(any(target_os = "android", target_os = "ios"))]
#[tauri::command]
pub async fn import_and_restore_backup() -> Result<Option<BackupReport>, String> {
    Err("Native desktop file dialog is not supported on mobile".to_string())
}
