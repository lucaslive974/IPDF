use crate::dtos::{IpcPlatformInfoDto, UpdateReadingPresenceDto};
use crate::state::BackendState;
use crate::utils::current_epoch_ms;
use ipdf_core::core::domain::BookMetadata;
use ipdf_core::core::ports::{
    ConfigurationStore, PresenceActivity, PresenceHealth, ReadingActivity,
};
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
    let supports_discord = env.platform_kind().supports_discord_presence()
        && cfg!(not(any(target_os = "android", target_os = "ios")));
    Ok(IpcPlatformInfoDto {
        platform: format!("{:?}", env.platform_kind()),
        config_dir: env.config_dir()?.to_string_lossy().to_string(),
        data_dir: env.data_dir()?.to_string_lossy().to_string(),
        cache_dir: env.cache_dir()?.to_string_lossy().to_string(),
        database_path: env
            .resolve_database_path("ipdf.db")?
            .to_string_lossy()
            .to_string(),
        supports_discord_presence: supports_discord,
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

#[tauri::command]
pub fn update_library_presence(
    total_books: u32,
    state: State<'_, Mutex<BackendState>>,
) -> Result<(), String> {
    let mut guard = state.lock().map_err(|e| e.to_string())?;
    let now = current_epoch_ms();
    let activity = PresenceActivity::Library {
        total_books,
        session_started_at_ms: now,
    };
    guard.presence_manager.update_activity(&activity, now, true);
    Ok(())
}

#[tauri::command]
pub fn update_annotations_presence(
    total_annotations: u32,
    state: State<'_, Mutex<BackendState>>,
) -> Result<(), String> {
    let mut guard = state.lock().map_err(|e| e.to_string())?;
    let now = current_epoch_ms();
    let activity = PresenceActivity::Annotations {
        total_annotations,
        session_started_at_ms: now,
    };
    guard.presence_manager.update_activity(&activity, now, true);
    Ok(())
}

#[tauri::command]
pub fn update_reading_presence(
    payload: UpdateReadingPresenceDto,
    state: State<'_, Mutex<BackendState>>,
) -> Result<(), String> {
    let mut guard = state.lock().map_err(|e| e.to_string())?;
    let now = current_epoch_ms();
    let total = payload.total_pages.max(1);
    let pct = (payload.current_page as f64 / total as f64) * 100.0;
    let activity = ReadingActivity {
        book_hash: payload.book_hash,
        book_title: payload.book_title,
        book_author: payload.book_author,
        chapter_title: payload.chapter_title,
        current_page: payload.current_page,
        total_pages: total,
        percentage: pct,
        state: "reading".to_string(),
        session_started_at_ms: now,
    };
    guard
        .presence_manager
        .update_reading_activity(&activity, now, false);
    Ok(())
}

#[tauri::command]
pub fn get_discord_presence_health(
    state: State<'_, Mutex<BackendState>>,
) -> Result<PresenceHealth, String> {
    let guard = state.lock().map_err(|e| e.to_string())?;
    if !guard.platform_env.platform_kind().supports_discord_presence()
        || cfg!(any(target_os = "android", target_os = "ios"))
    {
        return Ok(PresenceHealth {
            ok: false,
            message: "Discord Rich Presence requires a Desktop OS (Linux, Windows, macOS)"
                .to_string(),
        });
    }
    guard.presence_manager.check_provider_health("discord")
}
