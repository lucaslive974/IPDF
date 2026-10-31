use crate::domain::{BookFormat, BookMetadata, Highlight};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

pub trait BookRepository {
    fn save(&mut self, book: BookMetadata) -> Result<(), String>;
    fn find_by_id(&self, book_hash: &str) -> Result<Option<BookMetadata>, String>;
    fn update(&mut self, book: BookMetadata) -> Result<(), String>;
    fn delete(&mut self, book_hash: &str) -> Result<(), String>;
    fn find_all(&self) -> Result<Vec<BookMetadata>, String>;
}

pub trait HighlightRepository {
    fn save(&mut self, highlight: Highlight) -> Result<(), String>;
    fn find_by_id(&self, id: &str) -> Result<Option<Highlight>, String>;
    fn update(&mut self, highlight: Highlight) -> Result<(), String>;
    fn delete(&mut self, id: &str) -> Result<(), String>;
    fn find_by_book(&self, book_hash: &str) -> Result<Vec<Highlight>, String>;
    fn find_by_book_and_page(
        &self,
        book_hash: &str,
        page_number: u32,
    ) -> Result<Vec<Highlight>, String>;
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageEntry {
    pub name: String,
    pub size_bytes: usize,
    pub mime_type: String,
    pub modified_at_ms: i64,
}

pub trait StorageProvider {
    fn provider_id(&self) -> &str;
    fn initialize(&mut self) -> Result<bool, String>;
    fn is_available(&self) -> bool;

    fn has_book_binary(&self, book_hash: &str) -> Result<bool, String>;
    fn read_book_binary(&mut self, book_hash: &str) -> Result<Vec<u8>, String>;
    fn write_book_binary(
        &mut self,
        book_hash: &str,
        data: Vec<u8>,
        format: BookFormat,
    ) -> Result<(), String>;

    fn list_entries(&self, prefix: Option<&str>) -> Result<Vec<StorageEntry>, String>;
    fn read_entry(&mut self, name: &str) -> Result<Option<Vec<u8>>, String>;
    fn write_entry(
        &mut self,
        name: &str,
        data: &[u8],
        mime_type: &str,
    ) -> Result<StorageEntry, String>;
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncPayload {
    pub schema_version: u32,
    pub exported_at_ms: i64,
    pub device_id: String,
    pub books: Vec<BookMetadata>,
    pub highlights: Vec<Highlight>,
    #[serde(default)]
    pub binaries: Option<BTreeMap<String, Vec<u8>>>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportOptions {
    pub book_hashes: Option<Vec<String>>,
    pub include_book_files: bool,
    pub exported_at_ms: i64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ConflictResolution {
    LastWriteWins,
    KeepLocal,
    KeepImported,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportReport {
    pub books_imported: usize,
    pub books_updated: usize,
    pub highlights_added: usize,
    pub highlights_updated: usize,
    pub binaries_restored: usize,
    pub conflicts_resolved: usize,
}

pub trait ExportStrategy {
    fn serialize(&self, payload: &SyncPayload) -> Result<Vec<u8>, String>;
    fn deserialize(&self, raw: &[u8]) -> Result<SyncPayload, String>;
}

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
    fn publish_activity(&mut self, activity: &ReadingActivity) -> Result<(), String>;
    fn clear_activity(&mut self) -> Result<(), String>;
}
