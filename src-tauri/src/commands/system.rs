use crate::dtos::IpcPlatformInfoDto;
use crate::state::BackendState;
use ipdf_core::core::domain::BookMetadata;
use ipdf_core::core::ports::ConfigurationStore;
use std::sync::Mutex;
use tauri::State;

#[tauri::command]
pub fn healthcheck() -> &'static str {
    "IPDF Tauri v2 Native Backend Active"
}

#[tauri::command]
pub fn get_platform_info(
    state: State<'_, Mutex<BackendState>>,
) -> Result<IpcPlatformInfoDto, String> {
    let guard = state.lock().map_err(|e| e.to_string())?;
    let env = &guard.platform_env;
    Ok(IpcPlatformInfoDto {
        platform: format!("{:?}", env.platform_kind()),
        config_dir: env.config_dir()?.to_string_lossy().to_string(),
        data_dir: env.data_dir()?.to_string_lossy().to_string(),
        cache_dir: env.cache_dir()?.to_string_lossy().to_string(),
        database_path: env
            .resolve_database_path("ipdf.db")?
            .to_string_lossy()
            .to_string(),
    })
}

#[tauri::command]
pub fn get_startup_book(
    state: State<'_, Mutex<BackendState>>,
) -> Result<Option<BookMetadata>, String> {
    let mut guard = state.lock().map_err(|e| e.to_string())?;
    Ok(guard.startup_book.take())
}

#[tauri::command]
pub fn set_discord_presence_enabled(
    enabled: bool,
    state: State<'_, Mutex<BackendState>>,
) -> Result<(), String> {
    let mut guard = state.lock().map_err(|e| e.to_string())?;
    guard
        .config_store
        .set("discord_presence_enabled", if enabled { "true" } else { "false" })?;
    guard.presence_manager.set_provider_enabled("discord", enabled);
    Ok(())
}

#[tauri::command]
pub fn clear_rich_presence(state: State<'_, Mutex<BackendState>>) -> Result<(), String> {
    let mut guard = state.lock().map_err(|e| e.to_string())?;
    guard.presence_manager.clear_all_presence();
    Ok(())
}
