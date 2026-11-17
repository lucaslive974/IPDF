use crate::core::domain::{AppStoragePaths, BookFormat};
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
    fn get_book_size(&mut self, book_hash: &str) -> Result<u64, String> {
        self.read_book_binary(book_hash)
            .map(|bytes| bytes.len() as u64)
    }
    fn read_book_range(
        &mut self,
        book_hash: &str,
        offset: u64,
        length: usize,
    ) -> Result<Vec<u8>, String> {
        let bytes = self.read_book_binary(book_hash)?;
        let start = (offset as usize).min(bytes.len());
        let end = start.saturating_add(length).min(bytes.len());
        Ok(bytes[start..end].to_vec())
    }
    fn write_book_binary(
        &mut self,
        book_hash: &str,
        data: Vec<u8>,
        format: BookFormat,
    ) -> Result<(), String>;
    fn delete_book_binary(&mut self, book_hash: &str) -> Result<bool, String>;

    fn list_entries(&self, prefix: Option<&str>) -> Result<Vec<StorageEntry>, String>;
    fn read_entry(&mut self, name: &str) -> Result<Option<Vec<u8>>, String>;
    fn read_book_cover(&mut self, book_hash: &str) -> Result<Option<(Vec<u8>, String)>, String> {
        for ext in &["webp", "png", "jpg", "jpeg"] {
            let candidate = AppStoragePaths::cover_entry_name(book_hash, ext);
            if let Some(bytes) = self.read_entry(&candidate)? {
                if !bytes.is_empty() {
                    let mime = match *ext {
                        "png" => "image/png",
                        "webp" => "image/webp",
                        _ => "image/jpeg",
                    };
                    return Ok(Some((bytes, mime.to_string())));
                }
            }
        }
        Ok(None)
    }
    fn write_entry(
        &mut self,
        name: &str,
        data: &[u8],
        mime_type: &str,
    ) -> Result<StorageEntry, String>;
    fn write_book_cover(
        &mut self,
        book_hash: &str,
        data: &[u8],
        mime_type: &str,
    ) -> Result<String, String> {
        let _ = self.delete_book_cover(book_hash);
        let ext = match mime_type {
            "image/png" => "png",
            "image/webp" => "webp",
            _ => "jpg",
        };
        let entry_name = AppStoragePaths::cover_entry_name(book_hash, ext);
        self.write_entry(&entry_name, data, mime_type)?;
        Ok(entry_name)
    }
    fn delete_entry(&mut self, name: &str) -> Result<bool, String>;
    fn delete_book_cover(&mut self, book_hash: &str) -> Result<(), String> {
        for ext in &["webp", "png", "jpg", "jpeg"] {
            let candidate = AppStoragePaths::cover_entry_name(book_hash, ext);
            self.delete_entry(&candidate)?;
        }
        Ok(())
    }
    fn rename_entry(&mut self, old_name: &str, new_name: &str) -> Result<(), String>;
    fn resolve_entry_path(&self, _name: &str) -> Option<std::path::PathBuf> {
        None
    }
    fn clear(&mut self) -> Result<(), String>;
}
