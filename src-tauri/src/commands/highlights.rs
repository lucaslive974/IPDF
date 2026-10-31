use crate::dtos::{domain_to_ipc_highlight, ipc_highlight_to_domain, IpcHighlightDto};
use crate::state::BackendState;
use crate::utils::current_epoch_ms;
use ipdf_core::core::ports::HighlightRepository;
use std::sync::Mutex;
use tauri::State;

#[tauri::command]
pub fn load_book_highlights(
    book_hash: String,
    state: State<'_, Mutex<BackendState>>,
) -> Result<Vec<IpcHighlightDto>, String> {
    let guard = state.lock().map_err(|e| e.to_string())?;
    let domain_highlights = guard.highlight_repo.find_by_book(&book_hash)?;
    Ok(domain_highlights
        .into_iter()
        .map(domain_to_ipc_highlight)
        .collect())
}

#[tauri::command]
pub fn save_highlight(
    highlight: IpcHighlightDto,
    state: State<'_, Mutex<BackendState>>,
) -> Result<(), String> {
    let mut guard = state.lock().map_err(|e| e.to_string())?;
    let domain = ipc_highlight_to_domain(&highlight, current_epoch_ms());
    guard.highlight_repo.save(domain)?;
    Ok(())
}

#[tauri::command]
pub fn delete_highlight(
    highlight_id: String,
    state: State<'_, Mutex<BackendState>>,
) -> Result<(), String> {
    let mut guard = state.lock().map_err(|e| e.to_string())?;
    guard.highlight_repo.delete(&highlight_id)
}

#[tauri::command]
pub fn sync_book_workspace(
    book_hash: String,
    state: State<'_, Mutex<BackendState>>,
) -> Result<String, String> {
    let guard = state.lock().map_err(|e| e.to_string())?;
    let domain_highlights = guard.highlight_repo.find_by_book(&book_hash)?;
    let highlights: Vec<IpcHighlightDto> = domain_highlights
        .into_iter()
        .map(domain_to_ipc_highlight)
        .collect();

    let payload = serde_json::json!({
        "schemaVersion": 1,
        "engine": "ipdf-core (Rust Native LWW Sync)",
        "bookHash": book_hash,
        "highlightsCount": highlights.len(),
        "highlights": highlights,
    });

    serde_json::to_string_pretty(&payload).map_err(|e| e.to_string())
}
