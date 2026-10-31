use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PlaybackState {
    Playing,
    Paused,
    None,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaMetadata {
    pub book_title: String,
    pub author: String,
    pub chapter: Option<String>,
    pub cover_bytes: Option<Vec<u8>>,
}

pub trait NotificationService {
    fn request_permission(&mut self) -> Result<bool, String>;
    fn notify(&mut self, title: &str, body: &str, icon: Option<&str>) -> Result<(), String>;
}

pub trait MediaControlService {
    fn set_metadata(&mut self, metadata: &MediaMetadata) -> Result<(), String>;
    fn set_playback_state(&mut self, state: PlaybackState) -> Result<(), String>;
}

pub trait PowerSaveBlocker {
    fn keep_screen_awake(&mut self, enable: bool) -> Result<(), String>;
}

pub trait ClipboardService {
    fn write_text(&mut self, text: &str) -> Result<(), String>;
    fn read_text(&self) -> Result<String, String>;
}
