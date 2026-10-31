use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpeakOptions {
    pub voice_id: Option<String>,
    pub speed: f32,
    pub pitch: f32,
}

impl Default for SpeakOptions {
    fn default() -> Self {
        Self {
            voice_id: None,
            speed: 1.0,
            pitch: 1.0,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TtsBoundaryEvent {
    pub sentence_id: String,
    pub char_index: usize,
    pub char_length: usize,
    pub word: String,
}

pub trait TtsProvider {
    fn initialize(&mut self) -> Result<(), String>;
    fn speak(
        &mut self,
        sentence_id: &str,
        text: &str,
        options: &SpeakOptions,
    ) -> Result<(), String>;
    fn prefetch(
        &mut self,
        sentence_id: &str,
        text: &str,
        options: &SpeakOptions,
    ) -> Result<(), String>;
    fn pause(&mut self) -> Result<(), String>;
    fn resume(&mut self) -> Result<(), String>;
    fn stop(&mut self) -> Result<(), String>;
}
