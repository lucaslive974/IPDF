use crate::core::domain::{BookFormat, BookMetadata, BookStorageLocation};
use crate::core::ports::{BookRepository, StorageProvider};
use crate::core::services::Sha256BookHasher;

pub struct ImportBookInput {
    pub raw_bytes: Vec<u8>,
    pub title: String,
    pub author: String,
    pub format: BookFormat,
    pub total_pages: u32,
    pub now_ms: i64,
}

pub struct LibraryManager<
    S: StorageProvider,
    R: BookRepository = crate::adapters::persistence::SqliteBookRepository,
> {
    storage: S,
    book_repo: R,
}

impl<S: StorageProvider> LibraryManager<S, crate::adapters::persistence::SqliteBookRepository> {
    pub fn new(storage: S) -> Self {
        let book_repo = crate::adapters::persistence::SqliteBookRepository::new_in_memory()
            .expect("Failed to initialize in-memory SQLite book repository");
        Self { storage, book_repo }
    }
}

impl<S: StorageProvider, R: BookRepository> LibraryManager<S, R> {
    pub fn new_with_repo(storage: S, book_repo: R) -> Self {
        Self { storage, book_repo }
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

    pub fn initialize(&mut self) -> Result<bool, String> {
        self.storage.initialize()
    }

    pub fn import_book(&mut self, input: ImportBookInput) -> Result<BookMetadata, String> {
        let book_hash = Sha256BookHasher::hash_bytes(&input.raw_bytes)?;

        let total_pages = input.total_pages.max(1);

        let existing = self.book_repo.find_book_by_hash(&book_hash)?;
        let (current_page, percentage, page_offset_ratio) = match existing {
            Some(ref b) => (
                b.current_page.clamp(1, total_pages),
                b.percentage,
                b.page_offset_ratio,
            ),
            None => (
                1,
                ((1.0 / total_pages as f64) * 100.0).clamp(0.0, 100.0),
                0.0,
            ),
        };

        let metadata = BookMetadata {
            book_hash: book_hash.clone(),
            title: input.title,
            author: input.author,
            format: input.format,
            current_page,
            total_pages,
            percentage,
            description: None,
            tags: Vec::new(),
            page_offset_ratio,
            last_read_at_ms: input.now_ms,
            updated_at_ms: input.now_ms,
        };

        self.storage
            .write_book_binary(&book_hash, input.raw_bytes, input.format)?;

        self.book_repo.save_book(metadata.clone())?;

        let loc = BookStorageLocation::new(
            &book_hash,
            self.storage.provider_id(),
            format!(
                "/books/{}.{}",
                book_hash,
                match metadata.format {
                    BookFormat::Epub => "epub",
                    BookFormat::Pdf => "pdf",
                }
            ),
            true,
            Some(input.now_ms),
        );
        let _ = self.book_repo.add_storage_location(loc);

        Ok(metadata)
    }

    pub fn list_books(&mut self) -> Result<Vec<BookMetadata>, String> {
        self.book_repo.list_books()
    }

    pub fn get_book(&mut self, book_hash: &str) -> Result<Option<BookMetadata>, String> {
        self.book_repo.find_book_by_hash(book_hash)
    }

    pub fn update_reading_progress(
        &mut self,
        book_hash: &str,
        current_page: u32,
        total_pages: u32,
        page_offset_ratio: f64,
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
        book.page_offset_ratio = page_offset_ratio.clamp(-1.0, 1.0);
        book.last_read_at_ms = now_ms;
        book.updated_at_ms = now_ms;

        self.book_repo.save_book(book.clone())?;
        Ok(book)
    }

    pub fn rename_book(
        &mut self,
        book_hash: &str,
        new_title: &str,
    ) -> Result<BookMetadata, String> {
        let trimmed_title = new_title.trim();
        if trimmed_title.is_empty() {
            return Err("Book title cannot be empty".to_string());
        }

        let book = self
            .book_repo
            .find_book_by_hash(book_hash)?
            .ok_or_else(|| format!("Book not found: {book_hash}"))?;

        self.update_book_metadata(
            book_hash,
            trimmed_title,
            &book.author,
            &book.tags,
            book.description.as_deref(),
        )
    }

    pub fn update_book_metadata(
        &mut self,
        book_hash: &str,
        title: &str,
        author: &str,
        tags: &[String],
        description: Option<&str>,
    ) -> Result<BookMetadata, String> {
        let trimmed_title = title.trim();
        if trimmed_title.is_empty() {
            return Err("Book title cannot be empty".to_string());
        }
        let trimmed_author = author.trim();
        let final_author = if trimmed_author.is_empty() {
            "Unknown Author"
        } else {
            trimmed_author
        };
        self.book_repo.update_book_metadata(
            book_hash,
            trimmed_title,
            final_author,
            tags,
            description,
        )
    }

    pub fn list_authors(&self) -> Result<Vec<String>, String> {
        self.book_repo.list_authors()
    }

    pub fn list_tags(&self) -> Result<Vec<String>, String> {
        self.book_repo.list_tags()
    }

    pub fn delete_book(&mut self, book_hash: &str) -> Result<bool, String> {
        let _ = self.storage.delete_book_binary(book_hash);
        self.book_repo.delete_book(book_hash)
    }
}
