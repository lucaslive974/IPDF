use std::collections::BTreeMap;

const DISABLED_MSG: &str = "Cloud sync is disabled in this build";

#[tauri::command]
pub fn list_cloud_providers() -> Result<Vec<()>, String> {
    Ok(Vec::new())
}

#[tauri::command]
pub fn get_cloud_sync_status() -> Result<(), String> {
    Err(DISABLED_MSG.to_string())
}

#[tauri::command]
pub fn begin_google_oauth() -> Result<(), String> {
    Err(DISABLED_MSG.to_string())
}

#[tauri::command]
pub async fn complete_google_oauth() -> Result<(), String> {
    Err(DISABLED_MSG.to_string())
}

#[tauri::command]
pub async fn connect_google_drive() -> Result<(), String> {
    Err(DISABLED_MSG.to_string())
}

#[tauri::command]
pub async fn disconnect_cloud_provider() -> Result<(), String> {
    Err(DISABLED_MSG.to_string())
}

#[tauri::command]
pub async fn trigger_cloud_sync() -> Result<(), String> {
    Err(DISABLED_MSG.to_string())
}

#[tauri::command]
pub async fn notify_app_resumed() -> Result<Option<()>, String> {
    Ok(None)
}

#[tauri::command]
pub fn set_cloud_sync_interval() -> Result<(), String> {
    Err(DISABLED_MSG.to_string())
}

#[tauri::command]
pub async fn list_book_availabilities() -> Result<BTreeMap<String, ()>, String> {
    Ok(BTreeMap::new())
}

#[tauri::command]
pub async fn download_remote_book() -> Result<bool, String> {
    Err(DISABLED_MSG.to_string())
}

#[tauri::command]
pub fn evict_local_book() -> Result<bool, String> {
    Err(DISABLED_MSG.to_string())
}

#[tauri::command]
pub async fn clear_cloud_sync_data() -> Result<usize, String> {
    Err(DISABLED_MSG.to_string())
}
