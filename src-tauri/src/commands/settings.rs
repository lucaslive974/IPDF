use crate::state::BackendState;
use ipdf_core::core::ports::ConfigurationStore;
use std::sync::Mutex;
use tauri::State;

#[tauri::command]
pub fn get_app_setting(
    key: String,
    state: State<'_, Mutex<BackendState>>,
) -> Result<Option<String>, String> {
    let guard = state.lock().map_err(|e| e.to_string())?;
    guard.config_store.get(&key)
}

#[tauri::command]
pub fn set_app_setting(
    key: String,
    value: String,
    state: State<'_, Mutex<BackendState>>,
) -> Result<(), String> {
    let mut guard = state.lock().map_err(|e| e.to_string())?;
    guard.config_store.set(&key, &value)
}
