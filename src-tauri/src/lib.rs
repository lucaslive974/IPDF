use ipdf_core::adapters::persistence::{SqliteBookRepository, SqliteHighlightRepository};
use ipdf_core::adapters::storage::LocalFolderStorageAdapter;
use ipdf_core::core::domain::{BookFormat, BookMetadata, HighlightAnchor};
use ipdf_core::core::ports::{ReadingContext, StorageProvider};
use ipdf_core::core::services::{ImportBookInput, LibraryManager, PromptBuilder, Sha256BookHasher};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::env;
use std::io::Cursor;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::State;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IpcRichAnnotationDto {
    pub r#type: String,
    pub raw_data: String,
    pub svg_preview: Option<String>,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IpcHighlightDto {
    pub id: String,
    pub book_hash: String,
    pub text: String,
    pub color: String,
    pub anchor: HighlightAnchor,
    pub note: String,
    pub created_at: String,
    pub updated_at: String,
    pub annotations: Vec<IpcRichAnnotationDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IpcLlmRequestDto {
    pub system_prompt: String,
    pub user_prompt: String,
    pub temperature: f32,
    pub max_tokens: u32,
}

pub struct BackendState {
    highlights: BTreeMap<String, IpcHighlightDto>,
    library: LibraryManager<SqliteBookRepository, LocalFolderStorageAdapter>,
    _highlight_repo: SqliteHighlightRepository,
}

impl Default for BackendState {
    fn default() -> Self {
        let storage_dir = env::temp_dir().join("ipdf-workspace-storage");
        let mut storage = LocalFolderStorageAdapter::new("local-folder", storage_dir);
        let _ = storage.initialize();
        let book_repo =
            SqliteBookRepository::new_in_memory().expect("Failed to init SQLite BookRepository");
        let highlight_repo = SqliteHighlightRepository::new_in_memory()
            .expect("Failed to init SQLite HighlightRepository");
        let mut library = LibraryManager::new(book_repo, storage);

        let _ = library.import_book(ImportBookInput {
            raw_bytes: b"PK\x03\x04plato-republic-book-vii".to_vec(),
            title: "The Republic".to_string(),
            author: "Plato".to_string(),
            format: BookFormat::Epub,
            total_pages: 320,
            cover_image_url: None,
            now_ms: current_epoch_ms(),
        });

        Self {
            highlights: BTreeMap::new(),
            library,
            _highlight_repo: highlight_repo,
        }
    }
}

fn current_epoch_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

#[tauri::command]
fn healthcheck() -> &'static str {
    "IPDF Tauri v2 Native Backend Active"
}

#[tauri::command]
fn compute_book_sha256(bytes: Vec<u8>) -> Result<String, String> {
    Sha256BookHasher::hash_stream(Cursor::new(bytes))
}

#[tauri::command]
fn list_library_books(state: State<'_, Mutex<BackendState>>) -> Result<Vec<BookMetadata>, String> {
    let guard = state.lock().map_err(|e| e.to_string())?;
    guard.library.list_books()
}

#[tauri::command]
fn import_library_book(
    raw_bytes: Vec<u8>,
    title: String,
    author: String,
    format: BookFormat,
    total_pages: u32,
    cover_image_url: Option<String>,
    state: State<'_, Mutex<BackendState>>,
) -> Result<BookMetadata, String> {
    let mut guard = state.lock().map_err(|e| e.to_string())?;
    guard.library.import_book(ImportBookInput {
        raw_bytes,
        title,
        author,
        format,
        total_pages,
        cover_image_url,
        now_ms: current_epoch_ms(),
    })
}

#[tauri::command]
fn update_book_progress(
    book_hash: String,
    current_page: u32,
    total_pages: u32,
    state: State<'_, Mutex<BackendState>>,
) -> Result<BookMetadata, String> {
    let mut guard = state.lock().map_err(|e| e.to_string())?;
    guard.library.update_reading_progress(
        &book_hash,
        current_page,
        total_pages,
        current_epoch_ms(),
    )
}

#[tauri::command]
fn load_book_highlights(
    book_hash: String,
    state: State<'_, Mutex<BackendState>>,
) -> Result<Vec<IpcHighlightDto>, String> {
    let guard = state.lock().map_err(|e| e.to_string())?;
    let list = guard
        .highlights
        .values()
        .filter(|h| h.book_hash == book_hash)
        .cloned()
        .collect();
    Ok(list)
}

#[tauri::command]
fn save_highlight(
    highlight: IpcHighlightDto,
    state: State<'_, Mutex<BackendState>>,
) -> Result<(), String> {
    let mut guard = state.lock().map_err(|e| e.to_string())?;
    guard.highlights.insert(highlight.id.clone(), highlight);
    Ok(())
}

#[tauri::command]
fn delete_highlight(
    highlight_id: String,
    state: State<'_, Mutex<BackendState>>,
) -> Result<(), String> {
    let mut guard = state.lock().map_err(|e| e.to_string())?;
    guard.highlights.remove(&highlight_id);
    Ok(())
}

#[tauri::command]
fn build_term_lookup_prompt(
    book_title: String,
    book_author: Option<String>,
    chapter_title: Option<String>,
    selected_text: String,
    surrounding_context: String,
    target_language: Option<String>,
) -> IpcLlmRequestDto {
    let ctx = ReadingContext {
        book_title,
        book_author: book_author.unwrap_or_else(|| "Unknown".to_string()),
        chapter_title,
        selected_text,
        surrounding_context,
    };
    let req = PromptBuilder::build_term_lookup_request(
        &ctx,
        target_language.as_deref().unwrap_or("en"),
    );
    IpcLlmRequestDto {
        system_prompt: req.system_instruction,
        user_prompt: req.user_prompt,
        temperature: req.temperature,
        max_tokens: 500,
    }
}

#[tauri::command]
fn sync_book_workspace(
    book_hash: String,
    state: State<'_, Mutex<BackendState>>,
) -> Result<String, String> {
    let guard = state.lock().map_err(|e| e.to_string())?;
    let highlights: Vec<_> = guard
        .highlights
        .values()
        .filter(|h| h.book_hash == book_hash)
        .cloned()
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(Mutex::new(BackendState::default()))
        .invoke_handler(tauri::generate_handler![
            healthcheck,
            compute_book_sha256,
            list_library_books,
            import_library_book,
            update_book_progress,
            load_book_highlights,
            save_highlight,
            delete_highlight,
            build_term_lookup_prompt,
            sync_book_workspace
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
