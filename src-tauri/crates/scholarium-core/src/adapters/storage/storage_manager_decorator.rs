use crate::core::domain::{BookAvailability, BookFormat};
use crate::core::ports::{CloudStorageProvider, StorageEntry, StorageProvider};
use crate::core::services::CloudSyncPaths;
use std::path::PathBuf;
use std::sync::{Arc, RwLock};

/// Hybrid `StorageProvider` decorator combining a primary local storage adapter with an optional
/// remote `CloudStorageProvider` for on-demand book downloads.
///
/// When `remote` is `None` (local-only users), every operation delegates directly to `local`
/// with zero cloud overhead. Cloning shares the same runtime-swappable remote provider slot.
#[derive(Clone)]
pub struct StorageManagerDecorator<L: StorageProvider> {
    local: L,
    remote: Arc<RwLock<Option<Arc<dyn CloudStorageProvider>>>>,
}

impl<L: StorageProvider> StorageManagerDecorator<L> {
    pub fn new_local_only(local: L) -> Self {
        Self {
            local,
            remote: Arc::new(RwLock::new(None)),
        }
    }

    pub fn new(local: L, remote: Option<Arc<dyn CloudStorageProvider>>) -> Self {
        Self {
            local,
            remote: Arc::new(RwLock::new(remote)),
        }
    }

    pub fn set_remote(&mut self, remote: Option<Arc<dyn CloudStorageProvider>>) {
        if let Ok(mut guard) = self.remote.write() {
            *guard = remote;
        }
    }

    pub fn has_remote(&self) -> bool {
        self.remote.read().map(|g| g.is_some()).unwrap_or(false)
    }

    pub fn remote(&self) -> Option<Arc<dyn CloudStorageProvider>> {
        self.remote.read().ok().and_then(|g| g.clone())
    }

    pub fn local(&self) -> &L {
        &self.local
    }

    pub fn local_mut(&mut self) -> &mut L {
        &mut self.local
    }

    /// Returns whether the book's binary file is currently present on the local device.
    pub fn book_availability(&self, book_hash: &str) -> Result<BookAvailability, String> {
        if self.local.has_book_binary(book_hash)? {
            Ok(BookAvailability::Local)
        } else {
            Ok(BookAvailability::RemoteOnly)
        }
    }

    /// Ensures a book binary is downloaded locally, fetching from cloud storage if absent.
    /// Returns `Ok(true)` if downloaded from remote, or `Ok(false)` if already present locally.
    pub fn ensure_book_downloaded(
        &mut self,
        book_hash: &str,
        format: BookFormat,
    ) -> Result<bool, String> {
        if self.local.has_book_binary(book_hash)? {
            return Ok(false);
        }

        let Some(remote) = self.remote() else {
            return Err("No cloud storage provider configured".to_string());
        };

        let blob_path = CloudSyncPaths::book_blob(book_hash, format);
        let Some((bytes, _)) = remote.read(&blob_path).map_err(|e| e.to_string())? else {
            return Err(format!("Remote book blob not found: {blob_path}"));
        };

        self.local.write_book_binary(book_hash, bytes, format)?;
        Ok(true)
    }

    /// Removes only the local book binary to free device storage while keeping metadata and cover.
    pub fn evict_local_book(&mut self, book_hash: &str) -> Result<bool, String> {
        self.local.delete_book_binary(book_hash)
    }

    fn download_book_if_missing(&mut self, book_hash: &str) -> Result<(), String> {
        if self.local.has_book_binary(book_hash)? {
            return Ok(());
        }
        let Some(remote) = self.remote() else {
            return Ok(());
        };

        for format in [BookFormat::Epub, BookFormat::Pdf] {
            let blob_path = CloudSyncPaths::book_blob(book_hash, format);
            if let Some((bytes, _)) = remote.read(&blob_path).map_err(|e| e.to_string())? {
                self.local.write_book_binary(book_hash, bytes, format)?;
                return Ok(());
            }
        }
        Ok(())
    }
}

impl<L: StorageProvider> StorageProvider for StorageManagerDecorator<L> {
    fn provider_id(&self) -> &str {
        self.local.provider_id()
    }

    fn initialize(&mut self) -> Result<bool, String> {
        self.local.initialize()
    }

    fn is_available(&self) -> bool {
        self.local.is_available()
    }

    fn has_book_binary(&self, book_hash: &str) -> Result<bool, String> {
        self.local.has_book_binary(book_hash)
    }

    fn read_book_binary(&mut self, book_hash: &str) -> Result<Vec<u8>, String> {
        self.download_book_if_missing(book_hash)?;
        self.local.read_book_binary(book_hash)
    }

    fn get_book_size(&mut self, book_hash: &str) -> Result<u64, String> {
        self.download_book_if_missing(book_hash)?;
        self.local.get_book_size(book_hash)
    }

    fn read_book_range(
        &mut self,
        book_hash: &str,
        offset: u64,
        length: usize,
    ) -> Result<Vec<u8>, String> {
        self.download_book_if_missing(book_hash)?;
        self.local.read_book_range(book_hash, offset, length)
    }

    fn write_book_binary(
        &mut self,
        book_hash: &str,
        data: Vec<u8>,
        format: BookFormat,
    ) -> Result<(), String> {
        self.local.write_book_binary(book_hash, data, format)
    }

    fn delete_book_binary(&mut self, book_hash: &str) -> Result<bool, String> {
        self.local.delete_book_binary(book_hash)
    }

    fn list_entries(&self, prefix: Option<&str>) -> Result<Vec<StorageEntry>, String> {
        self.local.list_entries(prefix)
    }

    fn read_entry(&mut self, name: &str) -> Result<Option<Vec<u8>>, String> {
        self.local.read_entry(name)
    }

    fn write_entry(
        &mut self,
        name: &str,
        data: &[u8],
        mime_type: &str,
    ) -> Result<StorageEntry, String> {
        self.local.write_entry(name, data, mime_type)
    }

    fn delete_entry(&mut self, name: &str) -> Result<bool, String> {
        self.local.delete_entry(name)
    }

    fn rename_entry(&mut self, old_name: &str, new_name: &str) -> Result<(), String> {
        self.local.rename_entry(old_name, new_name)
    }

    fn resolve_entry_path(&self, name: &str) -> Option<PathBuf> {
        self.local.resolve_entry_path(name)
    }

    fn clear(&mut self) -> Result<(), String> {
        self.local.clear()
    }
}
