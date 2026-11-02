use crate::core::domain::types::BookFormat;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BookMetadata {
    pub book_hash: String,
    pub title: String,
    pub author: String,
    pub format: BookFormat,
    pub current_page: u32,
    pub total_pages: u32,
    pub percentage: f64,
    pub cover_image_url: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    pub last_read_at_ms: i64,
    pub updated_at_ms: i64,
}
