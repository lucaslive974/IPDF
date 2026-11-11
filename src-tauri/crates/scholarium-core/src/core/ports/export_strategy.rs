use crate::core::domain::{BookMetadata, Highlight};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

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
