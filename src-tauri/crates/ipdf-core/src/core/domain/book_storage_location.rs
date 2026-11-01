use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BookStorageLocation {
    pub book_hash: String,
    pub provider_id: String,
    pub storage_path: String,
    pub is_downloaded: bool,
    pub last_synced_at_ms: Option<i64>,
}

impl BookStorageLocation {
    pub fn new(
        book_hash: impl Into<String>,
        provider_id: impl Into<String>,
        storage_path: impl Into<String>,
        is_downloaded: bool,
        last_synced_at_ms: Option<i64>,
    ) -> Self {
        Self {
            book_hash: book_hash.into(),
            provider_id: provider_id.into(),
            storage_path: storage_path.into(),
            is_downloaded,
            last_synced_at_ms,
        }
    }
}
