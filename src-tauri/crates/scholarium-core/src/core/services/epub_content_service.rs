use crate::core::domain::BookPagePayload;
use crate::core::ports::{BookPaginator, StorageProvider};
use std::collections::BTreeMap;

pub struct EpubContentService<S: StorageProvider, P: BookPaginator> {
    storage: S,
    paginator: P,
    pages_cache: BTreeMap<String, Vec<BookPagePayload>>,
}

impl<S: StorageProvider, P: BookPaginator> EpubContentService<S, P> {
    pub fn new(storage: S, paginator: P) -> Self {
        Self {
            storage,
            paginator,
            pages_cache: BTreeMap::new(),
        }
    }

    pub fn storage(&self) -> &S {
        &self.storage
    }

    pub fn storage_mut(&mut self) -> &mut S {
        &mut self.storage
    }

    pub fn get_pages(
        &mut self,
        book_hash: &str,
        total_pages_hint: u32,
        start_page: u32,
        count: u32,
    ) -> Result<Vec<BookPagePayload>, String> {
        if !self.pages_cache.contains_key(book_hash) {
            let raw_bytes = self.storage.read_book_binary(book_hash)?;
            let pages = self.paginator.paginate(&raw_bytes, total_pages_hint)?;
            self.pages_cache.insert(book_hash.to_string(), pages);
        }

        let all_pages = self.pages_cache.get(book_hash).ok_or("Pages not found")?;
        if all_pages.is_empty() {
            return Ok(Vec::new());
        }

        let start_idx = (start_page.saturating_sub(1)) as usize;
        if start_idx >= all_pages.len() {
            return Ok(Vec::new());
        }

        let end_idx = (start_idx + count as usize).min(all_pages.len());
        Ok(all_pages[start_idx..end_idx].to_vec())
    }

    pub fn clear_cache(&mut self, book_hash: &str) {
        self.pages_cache.remove(book_hash);
    }

    pub fn count_pages_from_bytes(&self, raw_bytes: &[u8]) -> u32 {
        self.paginator
            .paginate(raw_bytes, 0)
            .map(|pages| pages.len() as u32)
            .unwrap_or(1)
            .max(1)
    }
}
