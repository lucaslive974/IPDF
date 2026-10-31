use crate::core::domain::BookFormat;
use serde::{Deserialize, Serialize};

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
    fn rename_entry(&mut self, old_name: &str, new_name: &str) -> Result<(), String>;
}
