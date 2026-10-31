use crate::core::domain::BookFormat;
use crate::core::ports::{StorageEntry, StorageProvider};

pub struct CachedStorageDecorator<L: StorageProvider, P: StorageProvider> {
    provider_id: String,
    local_cache: L,
    primary_storage: P,
    default_format: BookFormat,
}

impl<L: StorageProvider, P: StorageProvider> CachedStorageDecorator<L, P> {
    pub fn new(local_cache: L, primary_storage: P, default_format: BookFormat) -> Self {
        let provider_id = format!("cached:{}", primary_storage.provider_id());
        Self {
            provider_id,
            local_cache,
            primary_storage,
            default_format,
        }
    }
}

impl<L: StorageProvider, P: StorageProvider> StorageProvider for CachedStorageDecorator<L, P> {
    fn provider_id(&self) -> &str {
        &self.provider_id
    }

    fn initialize(&mut self) -> Result<bool, String> {
        self.local_cache.initialize()?;
        self.primary_storage.initialize()
    }

    fn is_available(&self) -> bool {
        self.primary_storage.is_available() || self.local_cache.is_available()
    }

    fn has_book_binary(&self, book_hash: &str) -> Result<bool, String> {
        if self.local_cache.has_book_binary(book_hash)? {
            return Ok(true);
        }
        if self.primary_storage.is_available() {
            return self.primary_storage.has_book_binary(book_hash);
        }
        Ok(false)
    }

    fn read_book_binary(&mut self, book_hash: &str) -> Result<Vec<u8>, String> {
        if self.local_cache.has_book_binary(book_hash)? {
            return self.local_cache.read_book_binary(book_hash);
        }
        let bytes = self.primary_storage.read_book_binary(book_hash)?;
        self.local_cache
            .write_book_binary(book_hash, bytes.clone(), self.default_format)?;
        Ok(bytes)
    }

    fn write_book_binary(
        &mut self,
        book_hash: &str,
        data: Vec<u8>,
        format: BookFormat,
    ) -> Result<(), String> {
        self.local_cache
            .write_book_binary(book_hash, data.clone(), format)?;
        if self.primary_storage.is_available() {
            self.primary_storage
                .write_book_binary(book_hash, data, format)?;
        }
        Ok(())
    }

    fn list_entries(&self, prefix: Option<&str>) -> Result<Vec<StorageEntry>, String> {
        if self.primary_storage.is_available() {
            return self.primary_storage.list_entries(prefix);
        }
        self.local_cache.list_entries(prefix)
    }

    fn read_entry(&mut self, name: &str) -> Result<Option<Vec<u8>>, String> {
        if self.primary_storage.is_available() {
            if let Some(bytes) = self.primary_storage.read_entry(name)? {
                self.local_cache
                    .write_entry(name, &bytes, "application/octet-stream")?;
                return Ok(Some(bytes));
            }
        }
        self.local_cache.read_entry(name)
    }

    fn write_entry(
        &mut self,
        name: &str,
        data: &[u8],
        mime_type: &str,
    ) -> Result<StorageEntry, String> {
        let local_res = self.local_cache.write_entry(name, data, mime_type)?;
        if self.primary_storage.is_available() {
            return self.primary_storage.write_entry(name, data, mime_type);
        }
        Ok(local_res)
    }

    fn rename_entry(&mut self, old_name: &str, new_name: &str) -> Result<(), String> {
        let cache_res = self.local_cache.rename_entry(old_name, new_name);
        if self.primary_storage.is_available() {
            return self.primary_storage.rename_entry(old_name, new_name);
        }
        cache_res
    }
}
