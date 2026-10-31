use ipdf_core::ports::{LlmRequest, ReadingContext};
use ipdf_core::services::{PromptBuilder, Sha256BookHasher};
use std::io::Cursor;

#[tauri::command]
fn healthcheck() -> &'static str {
    "IPDF Tauri v2 Native Backend Active"
}

#[tauri::command]
fn compute_book_sha256(bytes: Vec<u8>) -> Result<String, String> {
    Sha256BookHasher::hash_stream(Cursor::new(bytes))
}

#[tauri::command]
fn build_term_lookup_prompt(context: ReadingContext, target_lang: String) -> LlmRequest {
    PromptBuilder::build_term_lookup_request(&context, &target_lang)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            healthcheck,
            compute_book_sha256,
            build_term_lookup_prompt
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
