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
    pub format: BookFormat,
    pub current_page: u32,
    pub total_pages: u32,
    pub percentage: f64,
    pub last_read_at_ms: i64,
    pub cover_image_url: Option<String>,
    pub file_path: Option<String>,
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
    in_memory_books: BTreeMap<String, Vec<u8>>,
    auto_bundle_assets: bool,
}

impl<S: StorageProvider> LibraryManager<S> {
    pub fn new(storage: S) -> Self {
        Self {
            storage,
            progress_map: BTreeMap::new(),
            in_memory_books: BTreeMap::new(),
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
            self.progress_map
                .entry(DEFAULT_ASSET_HASH.to_string())
                .or_insert_with(|| ReadingProgress {
                    title: "The Republic".to_string(),
                    author: "Plato".to_string(),
                    format: BookFormat::Epub,
                    current_page: 1,
                    total_pages: 320,
                    percentage: 0.31,
                    last_read_at_ms: 0,
                    cover_image_url: None,
                    file_path: None,
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
        let total_pages = input.total_pages.max(1);
        let existing = self.progress_map.get(&book_hash).cloned();

        let (current_page, percentage) = match existing {
            Some(ref p) => (p.current_page.clamp(1, total_pages), p.percentage),
            None => (1, ((1.0 / total_pages as f64) * 100.0).clamp(0.0, 100.0)),
        };

        let progress = ReadingProgress {
            title: input.title.clone(),
            author: input.author.clone(),
            format: input.format,
            current_page,
            total_pages,
            percentage,
            last_read_at_ms: input.now_ms,
            cover_image_url: input.cover_image_url.clone(),
            file_path: None,
        };

        self.in_memory_books
            .insert(book_hash.clone(), input.raw_bytes);
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

        if self.auto_bundle_assets && !self.progress_map.contains_key(DEFAULT_ASSET_HASH) {
            self.progress_map.insert(
                DEFAULT_ASSET_HASH.to_string(),
                ReadingProgress {
                    title: "The Republic".to_string(),
                    author: "Plato".to_string(),
                    format: BookFormat::Epub,
                    current_page: 1,
                    total_pages: 320,
                    percentage: 0.31,
                    last_read_at_ms: 0,
                    cover_image_url: None,
                    file_path: None,
                },
            );
        }

        let mut books = Vec::new();
        for (book_hash, progress) in &self.progress_map {
            books.push(BookMetadata {
                book_hash: book_hash.clone(),
                title: progress.title.clone(),
                author: progress.author.clone(),
                format: progress.format,
                current_page: progress.current_page,
                total_pages: progress.total_pages,
                percentage: progress.percentage,
                cover_image_url: progress.cover_image_url.clone(),
                last_read_at_ms: progress.last_read_at_ms,
                updated_at_ms: progress.last_read_at_ms,
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
        if book_hash == DEFAULT_ASSET_HASH
            || book_hash == "sha256-plato-republic-book-vii"
            || book_hash == DEFAULT_ASSET_NAME
        {
            return Ok(BUNDLED_REPUBLIC_EPUB.to_vec());
        }

        if let Some(bytes) = self.in_memory_books.get(book_hash) {
            return Ok(bytes.clone());
        }

        if let Some(prog) = self.progress_map.get(book_hash) {
            if let Some(ref path_str) = prog.file_path {
                let path = Path::new(path_str);
                if path.exists() {
                    return fs::read(path).map_err(|e| e.to_string());
                }
            }
        }

        if self.storage.has_book_binary(book_hash)? {
            return self.storage.read_book_binary(book_hash);
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

        let total_pages = 100;
        let existing = self.progress_map.get(&book_hash).cloned();

        let (current_page, percentage) = match existing {
            Some(ref p) => (p.current_page.clamp(1, total_pages), p.percentage),
            None => (1, 1.0),
        };

        let now_ms = 0;
        let progress = ReadingProgress {
            title: stem.clone(),
            author: "Local File".to_string(),
            format,
            current_page,
            total_pages,
            percentage,
            last_read_at_ms: now_ms,
            cover_image_url: None,
            file_path: Some(path.to_string_lossy().to_string()),
        };

        self.progress_map.insert(book_hash.clone(), progress);
        let _ = self.persist_progress_cache();

        let metadata = BookMetadata {
            book_hash,
            title: stem,
            author: "Local File".to_string(),
            format,
            current_page,
            total_pages,
            percentage,
            cover_image_url: None,
            last_read_at_ms: now_ms,
            updated_at_ms: now_ms,
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
        let existing = self.progress_map.get(book_hash).cloned();

        let title = existing
            .as_ref()
            .map(|p| p.title.clone())
            .unwrap_or_else(|| "The Republic".to_string());
        let author = existing
            .as_ref()
            .map(|p| p.author.clone())
            .unwrap_or_else(|| "Plato".to_string());
        let format = existing
            .as_ref()
            .map(|p| p.format)
            .unwrap_or(BookFormat::Epub);
        let cover_image_url = existing.as_ref().and_then(|p| p.cover_image_url.clone());
        let file_path = existing.as_ref().and_then(|p| p.file_path.clone());

        let progress = ReadingProgress {
            title: title.clone(),
            author: author.clone(),
            format,
            current_page: clamped_page,
            total_pages: safe_total,
            percentage,
            last_read_at_ms: now_ms,
            cover_image_url: cover_image_url.clone(),
            file_path,
        };

        self.progress_map.insert(book_hash.to_string(), progress);
        self.persist_progress_cache()?;

        Ok(BookMetadata {
            book_hash: book_hash.to_string(),
            title,
            author,
            format,
            current_page: clamped_page,
            total_pages: safe_total,
            percentage,
            cover_image_url,
            last_read_at_ms: now_ms,
            updated_at_ms: now_ms,
        })
    }
}
