use crate::core::domain::{BookFormat, BookMetadata};
use crate::core::ports::StorageProvider;
use crate::core::services::Sha256BookHasher;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::fs;
use std::path::Path;

pub const DEFAULT_ASSET_NAME: &str = "republic-plato.epub";
pub const DEFAULT_ASSET_HASH: &str =
    "8c8bf2ed9bff65aaf226bf5db3879eb378a26e72489bd28666abc01c02f2a0c2";
pub const ASSET_INIT_MARKER: &str = ".installed_assets_v1";
pub const PROGRESS_FILE: &str = ".reading_progress.json";

pub const BUNDLED_REPUBLIC_EPUB: &[u8] =
    include_bytes!("../../../../../../assets/republic-plato.epub");

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ReadingProgress {
    pub title: String,
    pub author: String,
    pub current_page: u32,
    pub total_pages: u32,
    pub percentage: f64,
    pub last_read_at_ms: i64,
    pub cover_image_url: Option<String>,
}

pub struct ImportBookInput {
    pub raw_bytes: Vec<u8>,
    pub title: String,
    pub author: String,
    pub format: BookFormat,
    pub total_pages: u32,
    pub cover_image_url: Option<String>,
    pub now_ms: i64,
}

pub struct LibraryManager<S: StorageProvider> {
    storage: S,
    progress_map: BTreeMap<String, ReadingProgress>,
    auto_bundle_assets: bool,
}

impl<S: StorageProvider> LibraryManager<S> {
    pub fn new(storage: S) -> Self {
        Self {
            storage,
            progress_map: BTreeMap::new(),
            auto_bundle_assets: true,
        }
    }

    pub fn without_bundled_assets(mut self) -> Self {
        self.auto_bundle_assets = false;
        self
    }

    pub fn storage(&self) -> &S {
        &self.storage
    }

    pub fn storage_mut(&mut self) -> &mut S {
        &mut self.storage
    }

    pub fn initialize(&mut self) -> Result<bool, String> {
        let _ = self.storage.initialize()?;
        self.load_progress_cache()?;

        if self.auto_bundle_assets {
            self.ensure_bundled_assets()?;
        }

        Ok(true)
    }

    fn ensure_bundled_assets(&mut self) -> Result<(), String> {
        let marker = self.storage.read_entry(ASSET_INIT_MARKER)?;
        if marker.is_none() {
            // First run on this installation: deploy bundled sample books into data folder
            let _ = self.storage.write_entry(
                DEFAULT_ASSET_NAME,
                BUNDLED_REPUBLIC_EPUB,
                "application/epub+zip",
            )?;

            self.progress_map
                .entry(DEFAULT_ASSET_HASH.to_string())
                .or_insert_with(|| ReadingProgress {
                    title: "The Republic".to_string(),
                    author: "Plato".to_string(),
                    current_page: 1,
                    total_pages: 320,
                    percentage: 0.31,
                    last_read_at_ms: 0,
                    cover_image_url: None,
                });

            let _ = self
                .storage
                .write_entry(ASSET_INIT_MARKER, b"1", "text/plain")?;
            self.persist_progress_cache()?;
        }
        Ok(())
    }

    fn load_progress_cache(&mut self) -> Result<(), String> {
        if let Some(bytes) = self.storage.read_entry(PROGRESS_FILE)? {
            if let Ok(map) = serde_json::from_slice::<BTreeMap<String, ReadingProgress>>(&bytes) {
                self.progress_map = map;
            }
        }
        Ok(())
    }

    fn persist_progress_cache(&mut self) -> Result<(), String> {
        let json = serde_json::to_vec(&self.progress_map).map_err(|e| e.to_string())?;
        let _ = self
            .storage
            .write_entry(PROGRESS_FILE, &json, "application/json")?;
        Ok(())
    }

    pub fn import_book(&mut self, input: ImportBookInput) -> Result<BookMetadata, String> {
        let book_hash = Sha256BookHasher::hash_bytes(&input.raw_bytes)?;
        self.storage
            .write_book_binary(&book_hash, input.raw_bytes, input.format)?;

        let total_pages = input.total_pages.max(1);
        let existing = self.progress_map.get(&book_hash).cloned();

        let (current_page, percentage) = match existing {
            Some(ref p) => (p.current_page.clamp(1, total_pages), p.percentage),
            None => (1, ((1.0 / total_pages as f64) * 100.0).clamp(0.0, 100.0)),
        };

        let progress = ReadingProgress {
            title: input.title.clone(),
            author: input.author.clone(),
            current_page,
            total_pages,
            percentage,
            last_read_at_ms: input.now_ms,
            cover_image_url: input.cover_image_url.clone(),
        };

        self.progress_map.insert(book_hash.clone(), progress);
        self.persist_progress_cache()?;

        Ok(BookMetadata {
            book_hash,
            title: input.title,
            author: input.author,
            format: input.format,
            current_page,
            total_pages,
            percentage,
            cover_image_url: input.cover_image_url,
            last_read_at_ms: input.now_ms,
            updated_at_ms: input.now_ms,
        })
    }

    pub fn list_books(&mut self) -> Result<Vec<BookMetadata>, String> {
        self.load_progress_cache()?;
        let entries = self.storage.list_entries(None)?;
        let mut books = Vec::new();

        for entry in entries {
            let name = &entry.name;
            let format = if name.ends_with(".epub") {
                Some(BookFormat::Epub)
            } else if name.ends_with(".pdf") {
                Some(BookFormat::Pdf)
            } else {
                None
            };

            let Some(fmt) = format else {
                continue;
            };

            let (book_hash, default_title, default_author) = if name == DEFAULT_ASSET_NAME {
                (
                    DEFAULT_ASSET_HASH.to_string(),
                    "The Republic".to_string(),
                    "Plato".to_string(),
                )
            } else {
                let stem = name
                    .trim_end_matches(".epub")
                    .trim_end_matches(".pdf")
                    .to_string();
                (stem.clone(), stem, "Unknown".to_string())
            };

            let progress = self.progress_map.get(&book_hash);

            let title = progress.map(|p| p.title.clone()).unwrap_or(default_title);
            let author = progress.map(|p| p.author.clone()).unwrap_or(default_author);
            let total_pages = progress.map(|p| p.total_pages).unwrap_or(320);
            let current_page = progress.map(|p| p.current_page).unwrap_or(1);
            let percentage = progress.map(|p| p.percentage).unwrap_or(0.0);
            let last_read_at_ms = progress
                .map(|p| p.last_read_at_ms)
                .unwrap_or(entry.modified_at_ms);
            let cover_image_url = progress.and_then(|p| p.cover_image_url.clone());

            books.push(BookMetadata {
                book_hash,
                title,
                author,
                format: fmt,
                current_page,
                total_pages,
                percentage,
                cover_image_url,
                last_read_at_ms,
                updated_at_ms: entry.modified_at_ms,
            });
        }

        books.sort_by(|a, b| b.last_read_at_ms.cmp(&a.last_read_at_ms));
        Ok(books)
    }

    pub fn get_book(&mut self, book_hash: &str) -> Result<Option<BookMetadata>, String> {
        let all = self.list_books()?;
        Ok(all.into_iter().find(|b| b.book_hash == book_hash))
    }

    pub fn open_book_binary(&mut self, book_hash: &str) -> Result<Vec<u8>, String> {
        if self.storage.has_book_binary(book_hash)? {
            return self.storage.read_book_binary(book_hash);
        }

        if book_hash == DEFAULT_ASSET_HASH
            || book_hash == "sha256-plato-republic-book-vii"
            || book_hash == DEFAULT_ASSET_NAME
        {
            if let Some(bytes) = self.storage.read_entry(DEFAULT_ASSET_NAME)? {
                return Ok(bytes);
            }
            return Ok(BUNDLED_REPUBLIC_EPUB.to_vec());
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

        let metadata = BookMetadata {
            book_hash,
            title: stem,
            author: "Local File".to_string(),
            format,
            current_page: 1,
            total_pages: 100,
            percentage: 1.0,
            cover_image_url: None,
            last_read_at_ms: 0,
            updated_at_ms: 0,
        };

        Ok((metadata, bytes))
    }

    pub fn update_reading_progress(
        &mut self,
        book_hash: &str,
        current_page: u32,
        total_pages: u32,
        now_ms: i64,
    ) -> Result<BookMetadata, String> {
        let safe_total = total_pages.max(1);
        let clamped_page = current_page.clamp(1, safe_total);
        let percentage = ((clamped_page as f64 / safe_total as f64) * 100.0).clamp(0.0, 100.0);

        let entry = self
            .progress_map
            .entry(book_hash.to_string())
            .or_insert_with(|| ReadingProgress {
                title: "Book".to_string(),
                author: "Author".to_string(),
                current_page: clamped_page,
                total_pages: safe_total,
                percentage,
                last_read_at_ms: now_ms,
                cover_image_url: None,
            });

        entry.current_page = clamped_page;
        entry.total_pages = safe_total;
        entry.percentage = percentage;
        entry.last_read_at_ms = now_ms;

        let title = entry.title.clone();
        let author = entry.author.clone();
        let cover = entry.cover_image_url.clone();

        self.persist_progress_cache()?;

        Ok(BookMetadata {
            book_hash: book_hash.to_string(),
            title,
            author,
            format: BookFormat::Epub,
            current_page: clamped_page,
            total_pages: safe_total,
            percentage,
            cover_image_url: cover,
            last_read_at_ms: now_ms,
            updated_at_ms: now_ms,
        })
    }
}
