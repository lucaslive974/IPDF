use crate::state::BackendState;
use crate::utils::current_epoch_ms;
use ipdf_core::adapters::extractor::CoverExtractorAdapter;
use ipdf_core::core::domain::{BookMetadata, BookPagePayload};
use ipdf_core::core::ports::ReadingActivity;
use std::sync::Mutex;
use tauri::State;

#[tauri::command]
pub fn read_book_binary(
    book_hash: String,
    state: State<'_, Mutex<BackendState>>,
) -> Result<Vec<u8>, String> {
    let mut guard = state.lock().map_err(|e| e.to_string())?;
    guard.library.open_book_binary(&book_hash)
}

#[tauri::command]
pub fn get_book_pages(
    book_hash: String,
    start_page: u32,
    count: u32,
    state: State<'_, Mutex<BackendState>>,
) -> Result<Vec<BookPagePayload>, String> {
    let mut guard = state.lock().map_err(|e| e.to_string())?;
    guard.reader.get_book_pages(&book_hash, start_page, count)
}

#[tauri::command]
pub fn update_book_progress(
    book_hash: String,
    current_page: u32,
    total_pages: u32,
    state: State<'_, Mutex<BackendState>>,
) -> Result<BookMetadata, String> {
    let mut guard = state.lock().map_err(|e| e.to_string())?;
    let now = current_epoch_ms();
    let mut meta = guard
        .library
        .update_reading_progress(&book_hash, current_page, total_pages, now)?;
    meta.cover_image_url = CoverExtractorAdapter::resolve_cover_data_url(
        guard.library.storage_mut(),
        &meta.book_hash,
        meta.cover_image_url.as_deref(),
    );
    let total = total_pages.max(1);
    let pct = (current_page as f64 / total as f64) * 100.0;
    let activity = ReadingActivity {
        book_hash: meta.book_hash.clone(),
        book_title: meta.title.clone(),
        book_author: meta.author.clone(),
        chapter_title: None,
        current_page,
        total_pages: total,
        percentage: pct,
        state: "reading".to_string(),
        session_started_at_ms: now,
    };
    guard.presence_manager.update_activity(&activity, now, false);
    Ok(meta)
}
