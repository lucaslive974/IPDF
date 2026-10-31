use crate::core::domain::{BookFormat, BookMetadata};
use crate::core::ports::{BookRepository, StorageProvider};
use crate::core::services::Sha256BookHasher;

pub struct ImportBookInput {
    pub raw_bytes: Vec<u8>,
    pub title: String,
    pub author: String,
    pub format: BookFormat,
    pub total_pages: u32,
    pub cover_image_url: Option<String>,
    pub now_ms: i64,
}

pub struct LibraryManager<B: BookRepository, S: StorageProvider> {
    book_repo: B,
    storage: S,
}

impl<B: BookRepository, S: StorageProvider> LibraryManager<B, S> {
    pub fn new(book_repo: B, storage: S) -> Self {
        Self { book_repo, storage }
    }

    pub fn import_book(&mut self, input: ImportBookInput) -> Result<BookMetadata, String> {
        let book_hash = Sha256BookHasher::hash_bytes(&input.raw_bytes)?;
        self.storage
            .write_book_binary(&book_hash, input.raw_bytes, input.format)?;

        let total_pages = input.total_pages.max(1);

        if let Some(mut existing) = self.book_repo.find_by_id(&book_hash)? {
            existing.title = input.title;
            existing.author = input.author;
            existing.format = input.format;
            existing.total_pages = total_pages;
            if input.cover_image_url.is_some() {
                existing.cover_image_url = input.cover_image_url;
            }
            existing.last_read_at_ms = input.now_ms;
            existing.updated_at_ms = input.now_ms;
            self.book_repo.update(existing.clone())?;
            return Ok(existing);
        }

        let percentage = ((1.0 / total_pages as f64) * 100.0).clamp(0.0, 100.0);
        let metadata = BookMetadata {
            book_hash,
            title: input.title,
            author: input.author,
            format: input.format,
            current_page: 1,
            total_pages,
            percentage,
            cover_image_url: input.cover_image_url,
            last_read_at_ms: input.now_ms,
            updated_at_ms: input.now_ms,
        };

        self.book_repo.save(metadata.clone())?;
        Ok(metadata)
    }

    pub fn list_books(&self) -> Result<Vec<BookMetadata>, String> {
        let mut books = self.book_repo.find_all()?;
        books.sort_by(|a, b| b.last_read_at_ms.cmp(&a.last_read_at_ms));
        Ok(books)
    }

    pub fn get_book(&self, book_hash: &str) -> Result<Option<BookMetadata>, String> {
        self.book_repo.find_by_id(book_hash)
    }

    pub fn open_book_binary(&mut self, book_hash: &str) -> Result<Vec<u8>, String> {
        self.storage.read_book_binary(book_hash)
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
            .find_by_id(book_hash)?
            .ok_or_else(|| format!("Book not found: {book_hash}"))?;

        let safe_total = total_pages.max(1);
        let clamped_page = current_page.clamp(1, safe_total);
        book.current_page = clamped_page;
        book.total_pages = safe_total;
        book.percentage = ((clamped_page as f64 / safe_total as f64) * 100.0).clamp(0.0, 100.0);
        book.last_read_at_ms = now_ms;
        book.updated_at_ms = now_ms;

        self.book_repo.update(book.clone())?;
        Ok(book)
    }

    pub fn delete_book(&mut self, book_hash: &str) -> Result<(), String> {
        self.book_repo.delete(book_hash)
    }
}
