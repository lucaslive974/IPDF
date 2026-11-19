use crate::core::domain::highlight::Highlight;
use crate::core::domain::types::BookFormat;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;

/// Availability status of a book's binary file on the current device.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum BookAvailability {
    #[default]
    Local,
    RemoteOnly,
}

/// Global lightweight index stored at `sync-manifest.json` in cloud storage.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncManifest {
    pub schema_version: u32,
    pub revision: u64,
    pub updated_at_ms: i64,
    #[serde(default)]
    pub books: BTreeMap<String, ManifestBookEntry>,
}

impl SyncManifest {
    pub const CURRENT_SCHEMA_VERSION: u32 = 1;

    pub fn new_empty(now_ms: i64) -> Self {
        Self {
            schema_version: Self::CURRENT_SCHEMA_VERSION,
            revision: 0,
            updated_at_ms: now_ms,
            books: BTreeMap::new(),
        }
    }
}

/// Summary entry for a single book inside `SyncManifest`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManifestBookEntry {
    pub state_hash: String,
    pub format: BookFormat,
    #[serde(default)]
    pub cover_mime_type: Option<String>,
    #[serde(default)]
    pub file_size_bytes: Option<u64>,
    pub updated_at_ms: i64,
    #[serde(default)]
    pub deleted_at_ms: Option<i64>,
}

impl ManifestBookEntry {
    pub fn is_deleted(&self) -> bool {
        self.deleted_at_ms.is_some()
    }
}

/// Synced metadata fields for a book inside `state/{bookHash}.json`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BookSyncMetadata {
    pub title: String,
    pub author: String,
    pub format: BookFormat,
    pub total_pages: u32,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    pub updated_at_ms: i64,
}

/// Synced reading progress fields for a book inside `state/{bookHash}.json`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BookSyncProgress {
    pub current_page: u32,
    pub percentage: f64,
    #[serde(default)]
    pub page_offset_ratio: f64,
    pub last_read_at_ms: i64,
    pub updated_at_ms: i64,
}

/// Synced highlight entry supporting tombstones for cross-device deletion propagation.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HighlightSyncEntry {
    pub id: String,
    #[serde(default)]
    pub highlight: Option<Highlight>,
    pub updated_at_ms: i64,
    #[serde(default)]
    pub deleted_at_ms: Option<i64>,
}

impl HighlightSyncEntry {
    pub fn active(highlight: Highlight) -> Self {
        let id = highlight.id.clone();
        let updated_at_ms = highlight.updated_at_ms;
        Self {
            id,
            highlight: Some(highlight),
            updated_at_ms,
            deleted_at_ms: None,
        }
    }

    pub fn tombstone(id: impl Into<String>, deleted_at_ms: i64) -> Self {
        Self {
            id: id.into(),
            highlight: None,
            updated_at_ms: deleted_at_ms,
            deleted_at_ms: Some(deleted_at_ms),
        }
    }

    pub fn is_deleted(&self) -> bool {
        self.deleted_at_ms.is_some() || self.highlight.is_none()
    }
}

/// Full mutable state of a single book stored at `state/{bookHash}.json`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BookSyncState {
    pub book_hash: String,
    pub metadata: BookSyncMetadata,
    pub progress: BookSyncProgress,
    #[serde(default)]
    pub highlights: BTreeMap<String, HighlightSyncEntry>,
}

impl BookSyncState {
    /// Computes a deterministic SHA-256 hex digest of this book's serialized state.
    pub fn compute_state_hash(&self) -> Result<String, String> {
        let bytes = serde_json::to_vec(self).map_err(|e| e.to_string())?;
        let mut hasher = Sha256::new();
        hasher.update(&bytes);
        let digest = hasher.finalize();
        Ok(digest.iter().map(|b| format!("{b:02x}")).collect())
    }
}

/// Summary report returned after a cloud synchronization cycle completes.
#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncReport {
    pub revision: u64,
    pub pulled_books: usize,
    pub pushed_books: usize,
    pub uploaded_blobs: usize,
    pub downloaded_covers: usize,
    pub deleted_books: usize,
    pub retries: usize,
    pub synced_at_ms: i64,
}
