use crate::adapters::pagination::BookPaginatorFactory;
use crate::core::domain::{BookFormat, BookMetadata, BookStorageLocation};
use crate::core::ports::{BookRepository, StorageProvider};
use crate::core::services::Sha256BookHasher;
use std::collections::BTreeMap;
use std::fs;
use std::path::Path;

pub struct ImportBookInput {
    pub raw_bytes: Vec<u8>,
    pub title: String,
    pub author: String,
    pub format: BookFormat,
    pub total_pages: u32,
    pub cover_image_url: Option<String>,
    pub now_ms: i64,
}

pub struct LibraryManager<
    S: StorageProvider,
    R: BookRepository = crate::adapters::persistence::SqliteBookRepository,
> {
    storage: S,
    book_repo: R,
    in_memory_books: BTreeMap<String, Vec<u8>>,
}

impl<S: StorageProvider> LibraryManager<S, crate::adapters::persistence::SqliteBookRepository> {
    pub fn new(storage: S) -> Self {
        let book_repo = crate::adapters::persistence::SqliteBookRepository::new_in_memory()
            .expect("Failed to initialize in-memory SQLite book repository");
        Self {
            storage,
            book_repo,
            in_memory_books: BTreeMap::new(),
        }
    }
}

impl<S: StorageProvider, R: BookRepository> LibraryManager<S, R> {
    pub fn new_with_repo(storage: S, book_repo: R) -> Self {
        Self {
            storage,
            book_repo,
            in_memory_books: BTreeMap::new(),
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

    pub fn initialize(&mut self) -> Result<bool, String> {
        self.storage.initialize()
    }

    pub fn import_book(&mut self, input: ImportBookInput) -> Result<BookMetadata, String> {
        let book_hash = Sha256BookHasher::hash_bytes(&input.raw_bytes)?;

        let total_pages = if input.total_pages > 0 {
            input.total_pages
        } else {
            let paginator = BookPaginatorFactory::create(input.format);
            paginator
                .paginate(&input.raw_bytes, 0)
                .map(|pages| pages.len() as u32)
                .unwrap_or(1)
        }
        .max(1);

        let existing = self.book_repo.find_book_by_hash(&book_hash)?;
        let (current_page, percentage) = match existing {
            Some(ref b) => (b.current_page.clamp(1, total_pages), b.percentage),
            None => (1, ((1.0 / total_pages as f64) * 100.0).clamp(0.0, 100.0)),
        };

        let metadata = BookMetadata {
            book_hash: book_hash.clone(),
            title: input.title,
            author: input.author,
            format: input.format,
            current_page,
            total_pages,
            percentage,
            cover_image_url: input.cover_image_url,
            description: None,
            last_read_at_ms: input.now_ms,
            updated_at_ms: input.now_ms,
        };

        let _ = self
            .storage
            .write_book_binary(&book_hash, input.raw_bytes.clone(), input.format);
        self.in_memory_books
            .insert(book_hash.clone(), input.raw_bytes);

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

    pub fn open_book_binary(&mut self, book_hash: &str) -> Result<Vec<u8>, String> {
        if let Some(bytes) = self.in_memory_books.get(book_hash) {
            return Ok(bytes.clone());
        }

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

    pub fn open_book_from_path(&mut self, path: &Path) -> Result<(BookMetadata, Vec<u8>), String> {
        if !path.exists() {
            return Err(format!("Book file does not exist: {}", path.display()));
        }

        let bytes = fs::read(path).map_err(|e| e.to_string())?;
        let book_hash = Sha256BookHasher::hash_bytes(&bytes)?;

        let filename = path
            .file_name()
            .map(|f| f.to_string_lossy().to_string())
            .unwrap_or_else(|| "document".to_string());

        let format = if filename.ends_with(".pdf") {
            BookFormat::Pdf
        } else {
            BookFormat::Epub
        };

        let stem = path
            .file_stem()
            .map(|f| f.to_string_lossy().to_string())
            .unwrap_or_else(|| "Book".to_string());

        let paginator = BookPaginatorFactory::create(format);
        let total_pages = paginator
            .paginate(&bytes, 0)
            .map(|p| p.len() as u32)
            .unwrap_or(1)
            .max(1);

        let existing = self.book_repo.find_book_by_hash(&book_hash)?;
        let (current_page, percentage) = match existing {
            Some(ref b) => (b.current_page.clamp(1, total_pages), b.percentage),
            None => (1, ((1.0 / total_pages as f64) * 100.0).clamp(0.0, 100.0)),
        };

        let now_ms = 0;
        let metadata = BookMetadata {
            book_hash: book_hash.clone(),
            title: stem,
            author: "Local File".to_string(),
            format,
            current_page,
            total_pages,
            percentage,
            cover_image_url: None,
            description: None,
            last_read_at_ms: now_ms,
            updated_at_ms: now_ms,
        };

        self.in_memory_books
            .insert(book_hash.clone(), bytes.clone());
        self.book_repo.save_book(metadata.clone())?;

        let loc = BookStorageLocation::new(
            &book_hash,
            self.storage.provider_id(),
            path.to_string_lossy().to_string(),
            true,
            Some(now_ms),
        );
        let _ = self.book_repo.add_storage_location(loc);

        Ok((metadata, bytes))
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

    pub fn rename_book(
        &mut self,
        book_hash: &str,
        new_title: &str,
    ) -> Result<BookMetadata, String> {
        let trimmed_title = new_title.trim();
        if trimmed_title.is_empty() {
            return Err("Book title cannot be empty".to_string());
        }

        let mut book = self
            .book_repo
            .find_book_by_hash(book_hash)?
            .ok_or_else(|| format!("Book not found: {book_hash}"))?;

        book.title = trimmed_title.to_string();
        self.book_repo.save_book(book.clone())?;
        Ok(book)
    }

    pub fn delete_book(&mut self, book_hash: &str) -> Result<bool, String> {
        self.in_memory_books.remove(book_hash);
        let _ = self.storage.delete_book_binary(book_hash);
        self.book_repo.delete_book(book_hash)
    }
}
