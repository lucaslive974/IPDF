use ipdf_core::adapters::configuration::FileConfigurationStore;
use ipdf_core::adapters::persistence::SqliteHighlightRepository;
#[allow(unused_imports)]
use ipdf_core::adapters::platform::{
    AndroidEnvironment, IosEnvironment, LinuxEnvironment, WindowsEnvironment,
};
use ipdf_core::adapters::storage::LocalFolderStorageAdapter;
use ipdf_core::core::domain::{
    BookFormat, BookMetadata, Highlight, HighlightAnchor, RichAnnotation, RichAnnotationType,
};
use ipdf_core::core::ports::{
    ConfigurationStore, HighlightRepository, PlatformEnvironment, ReadingContext,
};
use ipdf_core::core::services::{ImportBookInput, LibraryManager, PromptBuilder, Sha256BookHasher};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IpcPlatformInfoDto {
    pub platform: String,
    pub config_dir: String,
    pub data_dir: String,
    pub cache_dir: String,
    pub database_path: String,
}

pub struct BackendState {
    highlights: BTreeMap<String, IpcHighlightDto>,
    library: LibraryManager<LocalFolderStorageAdapter>,
    highlight_repo: SqliteHighlightRepository,
    config_store: FileConfigurationStore,
    platform_env: Box<dyn PlatformEnvironment + Send>,
}

impl Default for BackendState {
    fn default() -> Self {
        #[cfg(target_os = "windows")]
        let platform: Box<dyn PlatformEnvironment + Send> = Box::new(WindowsEnvironment::default());
        #[cfg(target_os = "ios")]
        let platform: Box<dyn PlatformEnvironment + Send> = Box::new(IosEnvironment::default());
        #[cfg(target_os = "android")]
        let platform: Box<dyn PlatformEnvironment + Send> = Box::new(AndroidEnvironment::default());
        #[cfg(not(any(target_os = "windows", target_os = "ios", target_os = "android")))]
        let platform: Box<dyn PlatformEnvironment + Send> = Box::new(LinuxEnvironment::default());

        let storage = LocalFolderStorageAdapter::for_platform("local-folder", &*platform)
            .expect("Failed to init storage for platform");

        let highlight_repo = SqliteHighlightRepository::open_for_platform(&*platform)
            .unwrap_or_else(|_| SqliteHighlightRepository::new_in_memory().unwrap());
        let mut library = LibraryManager::new(storage);
        let _ = library.initialize();

        let config_store = FileConfigurationStore::for_platform(&*platform, "settings.json")
            .unwrap_or_else(|_| {
                let fallback_path = std::env::temp_dir().join("ipdf_settings.json");
                FileConfigurationStore::new(fallback_path).unwrap()
            });

        Self {
            highlights: BTreeMap::new(),
            library,
            highlight_repo,
            config_store,
            platform_env: platform,
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
    let mut guard = state.lock().map_err(|e| e.to_string())?;
    guard.library.list_books()
}

#[tauri::command]
fn open_book_file(
    file_path: String,
    state: State<'_, Mutex<BackendState>>,
) -> Result<BookMetadata, String> {
    let mut guard = state.lock().map_err(|e| e.to_string())?;
    let path = std::path::Path::new(&file_path);
    let (metadata, _) = guard.library.open_book_from_path(path)?;
    Ok(metadata)
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

fn domain_to_ipc_highlight(h: Highlight) -> IpcHighlightDto {
    let mut annots = Vec::new();
    for (k, v) in &h.annotations {
        let (raw_data, svg_preview) = match v {
            RichAnnotation::AssistedMarkdown { raw_data, .. } => (raw_data.clone(), None),
            RichAnnotation::Tldraw {
                raw_data,
                svg_preview,
                ..
            } => (raw_data.clone(), svg_preview.clone()),
            RichAnnotation::Drawio {
                raw_data,
                svg_preview,
                ..
            } => (raw_data.clone(), svg_preview.clone()),
        };
        annots.push(IpcRichAnnotationDto {
            r#type: match k {
                RichAnnotationType::AssistedMarkdown => "assisted-markdown".to_string(),
                RichAnnotationType::Tldraw => "tldraw".to_string(),
                RichAnnotationType::Drawio => "drawio".to_string(),
            },
            raw_data,
            svg_preview,
            updated_at: h.updated_at_ms.to_string(),
        });
    }
    IpcHighlightDto {
        id: h.id,
        book_hash: h.book_hash,
        text: h.text,
        color: h.color,
        anchor: h.anchor,
        note: h.note,
        created_at: h.created_at_ms.to_string(),
        updated_at: h.updated_at_ms.to_string(),
        annotations: annots,
    }
}

#[tauri::command]
fn load_book_highlights(
    book_hash: String,
    state: State<'_, Mutex<BackendState>>,
) -> Result<Vec<IpcHighlightDto>, String> {
    let guard = state.lock().map_err(|e| e.to_string())?;
    let domain_highlights = guard.highlight_repo.find_by_book(&book_hash)?;

    if !domain_highlights.is_empty() {
        return Ok(domain_highlights.into_iter().map(domain_to_ipc_highlight).collect());
    }

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

    let mut domain = Highlight::new(
        &highlight.id,
        &highlight.book_hash,
        &highlight.text,
        &highlight.color,
        highlight.anchor.clone(),
        &highlight.note,
        current_epoch_ms(),
    );

    for a in &highlight.annotations {
        let rich = match a.r#type.as_str() {
            "assisted-markdown" => RichAnnotation::AssistedMarkdown {
                raw_data: a.raw_data.clone(),
                updated_at_ms: current_epoch_ms(),
            },
            "tldraw" => RichAnnotation::Tldraw {
                raw_data: a.raw_data.clone(),
                svg_preview: a.svg_preview.clone(),
                updated_at_ms: current_epoch_ms(),
            },
            "drawio" => RichAnnotation::Drawio {
                raw_data: a.raw_data.clone(),
                svg_preview: a.svg_preview.clone(),
                updated_at_ms: current_epoch_ms(),
            },
            _ => continue,
        };
        domain.set_rich_annotation(rich, current_epoch_ms());
    }

    guard.highlight_repo.save(domain)?;
    guard.highlights.insert(highlight.id.clone(), highlight);
    Ok(())
}

#[tauri::command]
fn delete_highlight(
    highlight_id: String,
    state: State<'_, Mutex<BackendState>>,
) -> Result<(), String> {
    let mut guard = state.lock().map_err(|e| e.to_string())?;
    let _ = guard.highlight_repo.delete(&highlight_id);
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
    let highlights: Vec<IpcHighlightDto> = if let Ok(domain_highlights) =
        guard.highlight_repo.find_by_book(&book_hash)
    {
        if !domain_highlights.is_empty() {
            domain_highlights.into_iter().map(domain_to_ipc_highlight).collect()
        } else {
            guard
                .highlights
                .values()
                .filter(|h| h.book_hash == book_hash)
                .cloned()
                .collect()
        }
    } else {
        guard
            .highlights
            .values()
            .filter(|h| h.book_hash == book_hash)
            .cloned()
            .collect()
    };

    let payload = serde_json::json!({
        "schemaVersion": 1,
        "engine": "ipdf-core (Rust Native LWW Sync)",
        "bookHash": book_hash,
        "highlightsCount": highlights.len(),
        "highlights": highlights,
    });

    serde_json::to_string_pretty(&payload).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_platform_info(state: State<'_, Mutex<BackendState>>) -> Result<IpcPlatformInfoDto, String> {
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
fn get_app_setting(
    key: String,
    state: State<'_, Mutex<BackendState>>,
) -> Result<Option<String>, String> {
    let guard = state.lock().map_err(|e| e.to_string())?;
    guard.config_store.get(&key)
}

#[tauri::command]
fn set_app_setting(
    key: String,
    value: String,
    state: State<'_, Mutex<BackendState>>,
) -> Result<(), String> {
    let mut guard = state.lock().map_err(|e| e.to_string())?;
    guard.config_store.set(&key, &value)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(Mutex::new(BackendState::default()))
        .invoke_handler(tauri::generate_handler![
            healthcheck,
            compute_book_sha256,
            list_library_books,
            open_book_file,
            import_library_book,
            update_book_progress,
            load_book_highlights,
            save_highlight,
            delete_highlight,
            build_term_lookup_prompt,
            sync_book_workspace,
            get_platform_info,
            get_app_setting,
            set_app_setting
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
