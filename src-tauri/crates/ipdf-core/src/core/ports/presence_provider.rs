use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadingActivity {
    pub book_hash: String,
    pub book_title: String,
    pub book_author: String,
    pub chapter_title: Option<String>,
    pub current_page: u32,
    pub total_pages: u32,
    pub percentage: f64,
    pub state: String,
    pub session_started_at_ms: i64,
}

pub trait PresenceProvider {
    fn id(&self) -> &str;
    fn is_enabled(&self) -> bool;
    fn set_enabled(&mut self, enabled: bool);
    fn publish_activity(&mut self, activity: &ReadingActivity) -> Result<(), String>;
    fn clear_activity(&mut self) -> Result<(), String>;
}
