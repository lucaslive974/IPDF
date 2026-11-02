use crate::state::BackendState;
use crate::utils::current_epoch_ms;
use ipdf_core::adapters::extractor::CoverExtractorAdapter;
use ipdf_core::core::domain::{BookFormat, BookMetadata};
use ipdf_core::core::ports::{BookRepository, HighlightRepository, ReadingActivity};
use ipdf_core::core::services::{ImportBookInput, Sha256BookHasher};
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
    let mut books = guard.library.list_books()?;
    for book in &mut books {
        book.cover_image_url = CoverExtractorAdapter::resolve_cover_data_url(
            guard.library.storage_mut(),
            &book.book_hash,
            book.cover_image_url.as_deref(),
        );
    }
    Ok(books)
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
        if let Some(entry_name) = CoverExtractorAdapter::extract_and_persist_cover(
            guard.library.storage_mut(),
            metadata.format,
            &metadata.book_hash,
            &bytes,
        ) {
            metadata.cover_image_url = Some(entry_name.clone());
            if let Some(mut repo_book) = guard
                .library
                .book_repo_mut()
                .find_book_by_hash(&metadata.book_hash)
                .ok()
                .flatten()
            {
                repo_book.cover_image_url = Some(entry_name);
                let _ = guard.library.book_repo_mut().save_book(repo_book);
            }
        }
    }

    metadata.cover_image_url = CoverExtractorAdapter::resolve_cover_data_url(
        guard.library.storage_mut(),
        &metadata.book_hash,
        metadata.cover_image_url.as_deref(),
    );

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
    guard.presence_manager.update_reading_activity(&activity, now, true);
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
            if let Ok(book_hash) = Sha256BookHasher::hash_bytes(&raw_bytes) {
                CoverExtractorAdapter::extract_and_persist_cover(
                    guard.library.storage_mut(),
                    format,
                    &book_hash,
                    &raw_bytes,
                )
            } else {
                None
            }
        }
    };

    let mut meta = guard.library.import_book(ImportBookInput {
        raw_bytes,
        title,
        author,
        format,
        total_pages,
        cover_image_url: resolved_cover,
        now_ms: current_epoch_ms(),
    })?;

    meta.cover_image_url = CoverExtractorAdapter::resolve_cover_data_url(
        guard.library.storage_mut(),
        &meta.book_hash,
        meta.cover_image_url.as_deref(),
    );

    Ok(meta)
}

#[tauri::command]
pub fn rename_book(
    book_hash: String,
    new_title: String,
    state: State<'_, Mutex<BackendState>>,
) -> Result<BookMetadata, String> {
    let mut guard = state.lock().map_err(|e| e.to_string())?;
    let mut meta = guard.library.rename_book(&book_hash, &new_title)?;
    meta.cover_image_url = CoverExtractorAdapter::resolve_cover_data_url(
        guard.library.storage_mut(),
        &meta.book_hash,
        meta.cover_image_url.as_deref(),
    );
    Ok(meta)
}

#[tauri::command]
pub fn update_book_metadata(
    book_hash: String,
    title: String,
    author: String,
    tags: Vec<String>,
    description: Option<String>,
    state: State<'_, Mutex<BackendState>>,
) -> Result<BookMetadata, String> {
    let mut guard = state.lock().map_err(|e| e.to_string())?;
    let mut meta = guard.library.update_book_metadata(
        &book_hash,
        &title,
        &author,
        &tags,
        description.as_deref(),
    )?;
    meta.cover_image_url = CoverExtractorAdapter::resolve_cover_data_url(
        guard.library.storage_mut(),
        &meta.book_hash,
        meta.cover_image_url.as_deref(),
    );
    Ok(meta)
}

#[tauri::command]
pub fn list_authors(
    state: State<'_, Mutex<BackendState>>,
) -> Result<Vec<String>, String> {
    let guard = state.lock().map_err(|e| e.to_string())?;
    guard.library.list_authors()
}

#[tauri::command]
pub fn list_tags(
    state: State<'_, Mutex<BackendState>>,
) -> Result<Vec<String>, String> {
    let guard = state.lock().map_err(|e| e.to_string())?;
    guard.library.list_tags()
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
