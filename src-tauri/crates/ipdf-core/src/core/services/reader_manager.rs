use crate::adapters::pagination::BookPaginatorFactory;
use crate::core::domain::{BookMetadata, BookPagePayload};
use crate::core::ports::{BookRepository, StorageProvider};
use std::collections::BTreeMap;
use std::fs;
use std::path::Path;

pub struct ReaderManager<
    S: StorageProvider,
    R: BookRepository = crate::adapters::persistence::SqliteBookRepository,
> {
    storage: S,
    book_repo: R,
    pages_cache: BTreeMap<String, Vec<BookPagePayload>>,
}

impl<S: StorageProvider> ReaderManager<S, crate::adapters::persistence::SqliteBookRepository> {
    pub fn new(storage: S) -> Self {
        let book_repo = crate::adapters::persistence::SqliteBookRepository::new_in_memory()
            .expect("Failed to initialize in-memory SQLite book repository");
        Self {
            storage,
            book_repo,
            pages_cache: BTreeMap::new(),
        }
    }
}

impl<S: StorageProvider, R: BookRepository> ReaderManager<S, R> {
    pub fn new_with_repo(storage: S, book_repo: R) -> Self {
        Self {
            storage,
            book_repo,
            pages_cache: BTreeMap::new(),
        }
    }

    pub fn book_repo(&self) -> &R {
        &self.book_repo
    }

    pub fn book_repo_mut(&mut self) -> &mut R {
        &mut self.book_repo
    }

    pub fn storage(&self) -> &S {
        &self.storage
    }

    pub fn storage_mut(&mut self) -> &mut S {
        &mut self.storage
    }

    pub fn read_book_binary(&mut self, book_hash: &str) -> Result<Vec<u8>, String> {
        if self.storage.has_book_binary(book_hash)? {
            return self.storage.read_book_binary(book_hash);
        }

        if let Ok(locations) = self.book_repo.get_storage_locations(book_hash) {
            for loc in locations {
                let path = Path::new(&loc.storage_path);
                if path.exists() {
                    return fs::read(path).map_err(|e| e.to_string());
                }
            }
        }

        Err(format!("Book binary not found for hash: {book_hash}"))
    }

    pub fn get_book_pages(
        &mut self,
        book_hash: &str,
        start_page: u32,
        count: u32,
    ) -> Result<Vec<BookPagePayload>, String> {
        if !self.pages_cache.contains_key(book_hash) {
            let raw_bytes = self.read_book_binary(book_hash)?;
            let book = self
                .book_repo
                .find_book_by_hash(book_hash)?
                .ok_or_else(|| format!("Book metadata not found for hash: {book_hash}"))?;

            let paginator = BookPaginatorFactory::create(book.format);
            let pages = paginator.paginate(&raw_bytes, book.total_pages)?;
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

    pub fn update_reading_progress(
        &mut self,
        book_hash: &str,
        current_page: u32,
        total_pages: u32,
        now_ms: i64,
    ) -> Result<BookMetadata, String> {
        let mut book = self
            .book_repo
            .find_book_by_hash(book_hash)?
            .ok_or_else(|| format!("Book not found: {book_hash}"))?;

        let safe_total = total_pages.max(1);
        let clamped_page = current_page.clamp(1, safe_total);
        let percentage = ((clamped_page as f64 / safe_total as f64) * 100.0).clamp(0.0, 100.0);

        book.current_page = clamped_page;
        book.total_pages = safe_total;
        book.percentage = percentage;
        book.last_read_at_ms = now_ms;
        book.updated_at_ms = now_ms;

        self.book_repo.save_book(book.clone())?;
        Ok(book)
    }

    pub fn clear_cache(&mut self, book_hash: &str) {
        self.pages_cache.remove(book_hash);
    }
}
