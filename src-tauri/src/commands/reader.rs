use crate::dtos::UpdateBookProgressDto;
use crate::state::BackendState;
use crate::utils::current_epoch_ms;
use scholarium_core::core::domain::{BookMetadata, BookPagePayload};
use scholarium_core::core::ports::{BookRepository, StorageProvider};
use std::sync::Mutex;
use tauri::State;

#[tauri::command]
pub fn read_book_binary(
    book_hash: String,
    state: State<'_, Mutex<BackendState>>,
) -> Result<tauri::ipc::Response, String> {
    let mut guard = state.lock().map_err(|e| e.to_string())?;
    let bytes = guard.storage.read_book_binary(&book_hash)?;
    Ok(tauri::ipc::Response::new(bytes))
}

#[tauri::command]
pub fn get_book_file_size(
    book_hash: String,
    state: State<'_, Mutex<BackendState>>,
) -> Result<u64, String> {
    let mut guard = state.lock().map_err(|e| e.to_string())?;
    guard.storage.get_book_size(&book_hash)
}

#[tauri::command]
pub fn read_book_range(
    book_hash: String,
    begin: u64,
    end: u64,
    state: State<'_, Mutex<BackendState>>,
) -> Result<tauri::ipc::Response, String> {
    if end <= begin {
        return Ok(tauri::ipc::Response::new(Vec::<u8>::new()));
    }
    let length = (end - begin) as usize;
    let mut guard = state.lock().map_err(|e| e.to_string())?;
    let bytes = guard.storage.read_book_range(&book_hash, begin, length)?;
    Ok(tauri::ipc::Response::new(bytes))
}

#[tauri::command]
pub fn get_book_pages(
    book_hash: String,
    start_page: u32,
    count: u32,
    state: State<'_, Mutex<BackendState>>,
) -> Result<Vec<BookPagePayload>, String> {
    let mut guard = state.lock().map_err(|e| e.to_string())?;
    let total_pages_hint = guard
        .library
        .book_repo()
        .find_book_by_hash(&book_hash)?
        .map(|b| b.total_pages)
        .unwrap_or(0);
    guard
        .epub_content
        .get_pages(&book_hash, total_pages_hint, start_page, count)
}

#[tauri::command]
pub fn update_book_progress(
    payload: UpdateBookProgressDto,
    state: State<'_, Mutex<BackendState>>,
) -> Result<BookMetadata, String> {
    let mut guard = state.lock().map_err(|e| e.to_string())?;
    let now = current_epoch_ms();
    let updated = guard.library.update_reading_progress(
        &payload.book_hash,
        payload.current_page,
        payload.total_pages,
        payload.page_offset_ratio.unwrap_or(0.0),
        now,
    )?;
    guard.mark_sync_dirty();
    Ok(updated)
}
