use crate::dtos::IpcLlmRequestDto;
use ipdf_core::core::ports::ReadingContext;
use ipdf_core::core::services::PromptBuilder;

#[tauri::command]
pub fn build_term_lookup_prompt(
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
    let req =
        PromptBuilder::build_term_lookup_request(&ctx, target_language.as_deref().unwrap_or("en"));
    IpcLlmRequestDto {
        system_prompt: req.system_instruction,
        user_prompt: req.user_prompt,
        temperature: req.temperature,
        max_tokens: 500,
    }
}
