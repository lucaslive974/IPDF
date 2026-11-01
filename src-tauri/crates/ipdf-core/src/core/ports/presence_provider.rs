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

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum PresenceActivity {
    Reading(ReadingActivity),
    Library {
        total_books: u32,
        session_started_at_ms: i64,
    },
    Annotations {
        total_annotations: u32,
        session_started_at_ms: i64,
    },
}

impl From<ReadingActivity> for PresenceActivity {
    fn from(activity: ReadingActivity) -> Self {
        Self::Reading(activity)
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PresenceHealth {
    pub ok: bool,
    pub message: String,
}

pub trait PresenceProvider: Send {
    fn id(&self) -> &str;
    fn is_enabled(&self) -> bool;
    fn set_enabled(&mut self, enabled: bool);
    fn publish_activity(&mut self, activity: &PresenceActivity) -> Result<(), String>;
    fn clear_activity(&mut self) -> Result<(), String>;
    fn check_health(&self) -> Result<PresenceHealth, String>;
}
