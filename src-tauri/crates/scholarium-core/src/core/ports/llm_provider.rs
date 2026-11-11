use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadingContext {
    pub book_title: String,
    pub book_author: String,
    pub chapter_title: Option<String>,
    pub selected_text: String,
    pub surrounding_context: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LlmRequest {
    pub system_instruction: String,
    pub user_prompt: String,
    pub temperature: f32,
}
