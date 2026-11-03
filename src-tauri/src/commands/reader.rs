use crate::dtos::UpdateBookProgressDto;
use crate::state::BackendState;
use crate::utils::current_epoch_ms;
use ipdf_core::adapters::extractor::CoverExtractorAdapter;
use ipdf_core::core::domain::{BookMetadata, BookPagePayload};
use ipdf_core::core::ports::{BookRepository, ReadingActivity};
use std::sync::Mutex;
use tauri::State;

#[tauri::command]
pub fn get_book_file_path(
    book_hash: String,
    app: tauri::AppHandle,
    state: State<'_, Mutex<BackendState>>,
) -> Result<String, String> {
    use tauri::Manager;
    let mut guard = state.lock().map_err(|e| e.to_string())?;
    if let Ok(locations) = guard.library.book_repo_mut().get_storage_locations(&book_hash) {
        for loc in locations {
            let path = std::path::Path::new(&loc.storage_path);
            if path.exists() {
                let _ = app.asset_protocol_scope().allow_file(path);
                return Ok(loc.storage_path);
            }
        }
    }

    let root = guard.library.storage().root_dir();
    let pdf_path = root.join(format!("{book_hash}.pdf"));
    if pdf_path.exists() {
        let _ = app.asset_protocol_scope().allow_file(&pdf_path);
        return Ok(pdf_path.to_string_lossy().to_string());
    }
    let epub_path = root.join(format!("{book_hash}.epub"));
    if epub_path.exists() {
        let _ = app.asset_protocol_scope().allow_file(&epub_path);
        return Ok(epub_path.to_string_lossy().to_string());
    }

    Err(format!("File path not found for hash: {book_hash}"))
}

#[tauri::command]
pub fn read_book_binary(
    book_hash: String,
    state: State<'_, Mutex<BackendState>>,
) -> Result<tauri::ipc::Response, String> {
    let mut guard = state.lock().map_err(|e| e.to_string())?;
    let bytes = guard.library.open_book_binary(&book_hash)?;
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
    guard.reader.get_book_pages(&book_hash, start_page, count)
}

#[tauri::command]
pub fn update_book_progress(
    payload: UpdateBookProgressDto,
    state: State<'_, Mutex<BackendState>>,
) -> Result<BookMetadata, String> {
    let mut guard = state.lock().map_err(|e| e.to_string())?;
    let now = current_epoch_ms();
    let mut meta = guard.library.update_reading_progress(
        &payload.book_hash,
        payload.current_page,
        payload.total_pages,
        payload.page_offset_ratio.unwrap_or(0.0),
        now,
    )?;
    meta.cover_image_url = CoverExtractorAdapter::resolve_cover_data_url(
        guard.library.storage_mut(),
        &meta.book_hash,
        meta.cover_image_url.as_deref(),
    );
    let total = payload.total_pages.max(1);
    let pct = (payload.current_page as f64 / total as f64) * 100.0;
    let activity = ReadingActivity {
        book_hash: meta.book_hash.clone(),
        book_title: meta.title.clone(),
        book_author: meta.author.clone(),
        chapter_title: None,
        current_page: payload.current_page,
        total_pages: total,
        percentage: pct,
        state: "reading".to_string(),
        session_started_at_ms: now,
    };
    guard.presence_manager.update_reading_activity(&activity, now, false);
    Ok(meta)
}
