use ipdf_core::core::domain::HighlightAnchor;
use ipdf_core::core::ports::ReadingContext;
use ipdf_core::core::services::{PromptBuilder, Sha256BookHasher};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::io::Cursor;
use std::sync::Mutex;
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

#[derive(Default)]
pub struct BackendState {
    highlights: BTreeMap<String, IpcHighlightDto>,
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
            load_book_highlights,
            save_highlight,
            delete_highlight,
            build_term_lookup_prompt,
            sync_book_workspace
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
