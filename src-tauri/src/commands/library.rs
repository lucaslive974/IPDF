use crate::state::BackendState;
use crate::utils::current_epoch_ms;
use ipdf_core::core::domain::{BookFormat, BookMetadata, BookPagePayload};
use ipdf_core::core::ports::{BookRepository, HighlightRepository, ReadingActivity, StorageProvider};
use ipdf_core::core::services::{
    BookCoverExtractorFactory, ImportBookInput, Sha256BookHasher,
};
use std::io::Cursor;
use std::path::Path;
use std::sync::Mutex;
use tauri::State;

#[tauri::command]
pub fn compute_book_sha256(bytes: Vec<u8>) -> Result<String, String> {
    Sha256BookHasher::hash_stream(Cursor::new(bytes))
}

#[tauri::command]
pub fn list_library_books(
    state: State<'_, Mutex<BackendState>>,
) -> Result<Vec<BookMetadata>, String> {
    let mut guard = state.lock().map_err(|e| e.to_string())?;
    guard.library.list_books()
}

#[tauri::command]
pub fn open_book_file(
    file_path: String,
    state: State<'_, Mutex<BackendState>>,
) -> Result<BookMetadata, String> {
    let mut guard = state.lock().map_err(|e| e.to_string())?;
    let path = Path::new(&file_path);
    let (mut metadata, bytes) = guard.library.open_book_from_path(path)?;

    if metadata.cover_image_url.is_none() {
        let extractor = BookCoverExtractorFactory::create(metadata.format);
        if let Some(cover) = extractor.extract_cover(&bytes) {
            let entry_name = format!("covers/{}.{}", metadata.book_hash, cover.extension);
            if guard
                .library
                .storage_mut()
                .write_entry(&entry_name, &cover.data, &cover.mime_type)
                .is_ok()
            {
                let full_path = guard.library.storage().resolve_entry_path(&entry_name);
                let cover_path = full_path.to_string_lossy().to_string();
                metadata.cover_image_url = Some(cover_path);
                if let Some(mut repo_book) = guard
                    .library
                    .book_repo_mut()
                    .find_book_by_hash(&metadata.book_hash)
                    .ok()
                    .flatten()
                {
                    repo_book.cover_image_url = metadata.cover_image_url.clone();
                    let _ = guard.library.book_repo_mut().save_book(repo_book);
                }
            }
        }
    }

    let now = current_epoch_ms();
    let total = metadata.total_pages.max(1);
    let pct = (metadata.current_page as f64 / total as f64) * 100.0;
    let activity = ReadingActivity {
        book_hash: metadata.book_hash.clone(),
        book_title: metadata.title.clone(),
        book_author: metadata.author.clone(),
        chapter_title: None,
        current_page: metadata.current_page,
        total_pages: total,
        percentage: pct,
        state: "reading".to_string(),
        session_started_at_ms: now,
    };
    guard.presence_manager.update_activity(&activity, now, true);
    Ok(metadata)
}

#[tauri::command]
pub fn import_library_book(
    raw_bytes: Vec<u8>,
    title: String,
    author: String,
    format: BookFormat,
    total_pages: u32,
    cover_image_url: Option<String>,
    state: State<'_, Mutex<BackendState>>,
) -> Result<BookMetadata, String> {
    let mut guard = state.lock().map_err(|e| e.to_string())?;

    let resolved_cover = match cover_image_url {
        Some(url) if !url.trim().is_empty() => Some(url),
        _ => {
            let extractor = BookCoverExtractorFactory::create(format);
            if let Some(cover) = extractor.extract_cover(&raw_bytes) {
                if let Ok(book_hash) = Sha256BookHasher::hash_bytes(&raw_bytes) {
                    let entry_name = format!("covers/{}.{}", book_hash, cover.extension);
                    if guard
                        .library
                        .storage_mut()
                        .write_entry(&entry_name, &cover.data, &cover.mime_type)
                        .is_ok()
                    {
                        let full_path = guard.library.storage().resolve_entry_path(&entry_name);
                        Some(full_path.to_string_lossy().to_string())
                    } else {
                        None
                    }
                } else {
                    None
                }
            } else {
                None
            }
        }
    };

    let meta = guard.library.import_book(ImportBookInput {
        raw_bytes,
        title,
        author,
        format,
        total_pages,
        cover_image_url: resolved_cover,
        now_ms: current_epoch_ms(),
    })?;
    Ok(meta)
}

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
    let meta = guard
        .library
        .update_reading_progress(&book_hash, current_page, total_pages, now)?;
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

#[tauri::command]
pub fn rename_book(
    book_hash: String,
    new_title: String,
    state: State<'_, Mutex<BackendState>>,
) -> Result<BookMetadata, String> {
    let mut guard = state.lock().map_err(|e| e.to_string())?;
    guard.library.rename_book(&book_hash, &new_title)
}

#[tauri::command]
pub fn delete_book(
    book_hash: String,
    state: State<'_, Mutex<BackendState>>,
) -> Result<bool, String> {
    let mut guard = state.lock().map_err(|e| e.to_string())?;
    let _ = guard.highlight_repo.delete_by_book(&book_hash)?;
    guard.reader.clear_cache(&book_hash);
    guard.library.delete_book(&book_hash)
}
