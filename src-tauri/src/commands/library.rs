use crate::state::BackendState;
use crate::utils::current_epoch_ms;
use scholarium_core::adapters::extractor::CoverExtractorAdapter;
use scholarium_core::core::domain::{BookFormat, BookMetadata};
use scholarium_core::core::ports::{
    HighlightRepository, LogEntry, LogLevel, LogService, StorageProvider,
};
use scholarium_core::core::services::{ImportBookInput, Sha256BookHasher};
use std::io::Cursor;
use std::path::Path;
use std::sync::Mutex;
use tauri::State;

// Queries

#[tauri::command]
pub fn list_library_books(
    state: State<'_, Mutex<BackendState>>,
) -> Result<Vec<BookMetadata>, String> {
    let mut guard = state.lock().map_err(|e| e.to_string())?;
    guard.library.list_books()
}

#[tauri::command]
pub fn list_authors(state: State<'_, Mutex<BackendState>>) -> Result<Vec<String>, String> {
    let guard = state.lock().map_err(|e| e.to_string())?;
    guard.library.list_authors()
}

#[tauri::command]
pub fn list_tags(state: State<'_, Mutex<BackendState>>) -> Result<Vec<String>, String> {
    let guard = state.lock().map_err(|e| e.to_string())?;
    guard.library.list_tags()
}

#[tauri::command]
pub fn compute_book_sha256(bytes: Vec<u8>) -> Result<String, String> {
    Sha256BookHasher::hash_stream(Cursor::new(bytes))
}

// Import

#[tauri::command]
pub fn import_books_from_paths(
    file_paths: Vec<String>,
    app: tauri::AppHandle,
    state: State<'_, Mutex<BackendState>>,
) -> Result<Vec<BookMetadata>, String> {
    let mut guard = state.lock().map_err(|e| e.to_string())?;
    let mut results = Vec::with_capacity(file_paths.len());

    for file_path in &file_paths {
        match process_single_book_path(&mut guard, &app, Path::new(file_path)) {
            Ok(metadata) => results.push(metadata),
            Err(err) => {
                let _ = guard.logger.log(LogEntry::new(
                    current_epoch_ms(),
                    LogLevel::Error,
                    "library",
                    format!("Failed to import book from path {file_path}: {err}"),
                ));
            }
        }
    }

    Ok(results)
}

#[tauri::command]
pub fn import_book_from_bytes(
    raw_bytes: Vec<u8>,
    title: String,
    author: String,
    format: BookFormat,
    total_pages: u32,
    state: State<'_, Mutex<BackendState>>,
) -> Result<BookMetadata, String> {
    let mut guard = state.lock().map_err(|e| e.to_string())?;
    import_book_into_state(&mut guard, raw_bytes, title, author, format, total_pages)
}

#[cfg(not(any(target_os = "android", target_os = "ios")))]
#[tauri::command]
pub async fn pick_and_import_book(
    app: tauri::AppHandle,
    state: State<'_, Mutex<BackendState>>,
) -> Result<Option<BookMetadata>, String> {
    let handle = rfd::AsyncFileDialog::new()
        .add_filter("Books (*.epub, *.pdf)", &["epub", "pdf"])
        .set_title("Import Book")
        .pick_file()
        .await;

    let Some(file_handle) = handle else {
        return Ok(None);
    };

    let mut guard = state.lock().map_err(|e| e.to_string())?;
    let metadata = process_single_book_path(&mut guard, &app, file_handle.path())?;
    Ok(Some(metadata))
}

#[cfg(any(target_os = "android", target_os = "ios"))]
#[tauri::command]
pub async fn pick_and_import_book() -> Result<Option<BookMetadata>, String> {
    Err("Native desktop file dialog is not supported on mobile".to_string())
}

// Mutations

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
pub fn update_book_metadata(
    book_hash: String,
    title: String,
    author: String,
    tags: Vec<String>,
    description: Option<String>,
    state: State<'_, Mutex<BackendState>>,
) -> Result<BookMetadata, String> {
    let mut guard = state.lock().map_err(|e| e.to_string())?;
    guard
        .library
        .update_book_metadata(&book_hash, &title, &author, &tags, description.as_deref())
}

#[tauri::command]
pub fn delete_book(
    book_hash: String,
    state: State<'_, Mutex<BackendState>>,
) -> Result<bool, String> {
    let mut guard = state.lock().map_err(|e| e.to_string())?;
    let _ = guard.highlight_repo.delete_by_book(&book_hash)?;
    guard.epub_content.clear_cache(&book_hash);
    let _ = guard.storage.delete_book_cover(&book_hash);
    guard.library.delete_book(&book_hash)
}

// Helpers

fn process_single_book_path(
    guard: &mut BackendState,
    app: &tauri::AppHandle,
    path: &Path,
) -> Result<BookMetadata, String> {
    use tauri::Manager;
    let _ = app.asset_protocol_scope().allow_file(path);
    let file = crate::utils::read_local_book_file(path)?;
    import_book_into_state(
        guard,
        file.raw_bytes,
        file.title,
        "Unknown".to_string(),
        file.format,
        0,
    )
}

fn import_book_into_state(
    guard: &mut BackendState,
    raw_bytes: Vec<u8>,
    title: String,
    author: String,
    format: BookFormat,
    total_pages: u32,
) -> Result<BookMetadata, String> {
    let resolved_total_pages = if total_pages > 0 {
        total_pages
    } else if format == BookFormat::Epub {
        guard.epub_content.count_pages_from_bytes(&raw_bytes)
    } else {
        1
    };

    let metadata = guard.library.import_book(ImportBookInput {
        raw_bytes: raw_bytes.clone(),
        title,
        author,
        format,
        total_pages: resolved_total_pages,
        now_ms: current_epoch_ms(),
    })?;

    if let Some(cover) = CoverExtractorAdapter::extract_cover(metadata.format, &raw_bytes) {
        let _ = guard
            .storage
            .write_book_cover(&metadata.book_hash, &cover.data, &cover.mime_type);
    }

    Ok(metadata)
}

#[tauri::command]
pub async fn save_book_cover(
    request: tauri::ipc::Request<'_>,
    state: State<'_, Mutex<BackendState>>,
) -> Result<(), String> {
    let book_hash = request
        .headers()
        .get("x-book-hash")
        .and_then(|v| v.to_str().ok())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "Missing x-book-hash header".to_string())?;
    let mime_type = request
        .headers()
        .get("x-mime-type")
        .and_then(|v| v.to_str().ok())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or("image/jpeg");
    let bytes = match request.body() {
        tauri::ipc::InvokeBody::Raw(data) => data.as_slice(),
        _ => return Err("Expected raw binary body".to_string()),
    };

    let mut guard = state.lock().map_err(|e| e.to_string())?;
    if bytes.is_empty() {
        guard.storage.delete_book_cover(book_hash)?;
    } else {
        guard
            .storage
            .write_book_cover(book_hash, bytes, mime_type)?;
    }
    Ok(())
}

#[tauri::command]
pub async fn delete_book_cover(
    book_hash: String,
    state: State<'_, Mutex<BackendState>>,
) -> Result<(), String> {
    let mut guard = state.lock().map_err(|e| e.to_string())?;
    guard.storage.delete_book_cover(&book_hash)
}
