use crate::core::domain::{BookFormat, BookMetadata, BookPagePayload, BookStorageLocation};
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
    pages_cache: BTreeMap<String, Vec<BookPagePayload>>,
}

impl<S: StorageProvider> LibraryManager<S, crate::adapters::persistence::SqliteBookRepository> {
    pub fn new(storage: S) -> Self {
        let book_repo = crate::adapters::persistence::SqliteBookRepository::new_in_memory()
            .expect("Failed to initialize in-memory SQLite book repository");
        Self {
            storage,
            book_repo,
            in_memory_books: BTreeMap::new(),
            pages_cache: BTreeMap::new(),
        }
    }
}

impl<S: StorageProvider, R: BookRepository> LibraryManager<S, R> {
    pub fn new_with_repo(storage: S, book_repo: R) -> Self {
        Self {
            storage,
            book_repo,
            in_memory_books: BTreeMap::new(),
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

    pub fn initialize(&mut self) -> Result<bool, String> {
        self.storage.initialize()
    }

    pub fn import_book(&mut self, input: ImportBookInput) -> Result<BookMetadata, String> {
        let book_hash = Sha256BookHasher::hash_bytes(&input.raw_bytes)?;
        let pages = Self::parse_and_paginate_book(&input.raw_bytes, input.total_pages)?;
        let total_pages = (pages.len() as u32).max(1);
        self.pages_cache.insert(book_hash.clone(), pages);

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

        let pages = Self::parse_and_paginate_book(&bytes, 0)?;
        let total_pages = (pages.len() as u32).max(1);
        self.pages_cache.insert(book_hash.clone(), pages);

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
        self.pages_cache.remove(book_hash);
        let _ = self.storage.delete_book_binary(book_hash);
        self.book_repo.delete_book(book_hash)
    }

    pub fn get_book_pages(
        &mut self,
        book_hash: &str,
        start_page: u32,
        count: u32,
    ) -> Result<Vec<BookPagePayload>, String> {
        if !self.pages_cache.contains_key(book_hash) {
            let raw_bytes = self.open_book_binary(book_hash)?;
            let total_pages = self
                .book_repo
                .find_book_by_hash(book_hash)?
                .map(|b| b.total_pages)
                .unwrap_or(320);

            let pages = Self::parse_and_paginate_book(&raw_bytes, total_pages)?;
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

    fn parse_and_paginate_book(
        raw_bytes: &[u8],
        target_total_pages: u32,
    ) -> Result<Vec<BookPagePayload>, String> {
        let mut paragraphs_with_title = Vec::new();

        if raw_bytes.len() > 30 && raw_bytes.starts_with(b"PK\x03\x04") {
            let cursor = std::io::Cursor::new(raw_bytes);
            if let Ok(mut archive) = zip::ZipArchive::new(cursor) {
                let mut chapter_index = 1usize;
                for i in 0..archive.len() {
                    if let Ok(mut file) = archive.by_index(i) {
                        let Ok(file_name) = file.name() else {
                            continue;
                        };
                        let name = file_name.to_lowercase();
                        if (name.ends_with(".xhtml")
                            || name.ends_with(".html")
                            || name.ends_with(".htm"))
                            && !name.contains("wrap")
                            && !name.contains("cover")
                            && !name.contains("toc")
                        {
                            use std::io::Read;
                            let mut content = String::new();
                            if file.read_to_string(&mut content).is_ok() && !content.is_empty() {
                                let title = Self::extract_html_title(&content)
                                    .unwrap_or_else(|| format!("Chapter {}", chapter_index));
                                let paras = Self::extract_html_paragraphs(&content);
                                for p in paras {
                                    paragraphs_with_title.push((p, title.clone(), chapter_index));
                                }
                                chapter_index += 1;
                            }
                        }
                    }
                }
            }
        }

        if paragraphs_with_title.is_empty() {
            let text = String::from_utf8_lossy(raw_bytes);
            let cleaned = text.trim();
            if !cleaned.is_empty() {
                paragraphs_with_title.push((cleaned.to_string(), "Chapter 1".to_string(), 1));
            } else {
                paragraphs_with_title.push((
                    "Empty document".to_string(),
                    "Chapter 1".to_string(),
                    1,
                ));
            }
        }

        let total_pages = if target_total_pages > 0 {
            target_total_pages
        } else {
            paragraphs_with_title.len().div_ceil(14).max(1) as u32
        };

        let mut pages = Vec::with_capacity(total_pages as usize);
        let total_paras = paragraphs_with_title.len();

        for k in 1..=total_pages {
            let start = ((k - 1) as usize * total_paras) / total_pages as usize;
            let end = (k as usize * total_paras) / total_pages as usize;
            let slice = &paragraphs_with_title[start..end.max(start + 1).min(total_paras)];

            let (first_title, first_ch_idx) = slice
                .first()
                .map(|(_, t, idx)| (t.clone(), *idx))
                .unwrap_or_else(|| ("Chapter 1".to_string(), 1));

            let page_paras: Vec<String> = slice.iter().map(|(p, _, _)| p.clone()).collect();
            let cfi_base = format!("epubcfi(/6/{}!/4/2)", first_ch_idx * 2);

            pages.push(BookPagePayload {
                page_number: k,
                chapter_title: first_title,
                paragraphs: page_paras,
                cfi_base,
            });
        }

        Ok(pages)
    }

    fn extract_html_title(html: &str) -> Option<String> {
        if let Some(start) = html.find("<title") {
            if let Some(open_end) = html[start..].find('>') {
                let content_start = start + open_end + 1;
                if let Some(close) = html[content_start..].find("</title>") {
                    let title = &html[content_start..content_start + close];
                    let trimmed = title.trim();
                    if !trimmed.is_empty() {
                        return Some(Self::clean_entities(trimmed));
                    }
                }
            }
        }
        if let Some(start) = html.find("<h1") {
            if let Some(open_end) = html[start..].find('>') {
                let content_start = start + open_end + 1;
                if let Some(close) = html[content_start..].find("</h1>") {
                    let title = &html[content_start..content_start + close];
                    let trimmed = Self::strip_tags(title).trim().to_string();
                    if !trimmed.is_empty() {
                        return Some(Self::clean_entities(&trimmed));
                    }
                }
            }
        }
        None
    }

    fn extract_html_paragraphs(html: &str) -> Vec<String> {
        let mut paragraphs = Vec::new();
        let mut cursor = 0;
        let lower = html.to_lowercase();

        while let Some(p_start) = lower[cursor..].find("<p") {
            let actual_start = cursor + p_start;
            if let Some(open_end) = lower[actual_start..].find('>') {
                let content_start = actual_start + open_end + 1;
                if let Some(p_close) = lower[content_start..].find("</p>") {
                    let raw_p = &html[content_start..content_start + p_close];
                    let stripped = Self::strip_tags(raw_p);
                    let cleaned = Self::clean_entities(&stripped);
                    let trimmed = cleaned.trim();
                    if trimmed.len() > 5 {
                        paragraphs.push(trimmed.to_string());
                    }
                    cursor = content_start + p_close + 4;
                    continue;
                }
            }
            cursor = actual_start + 2;
        }

        if paragraphs.is_empty() {
            let stripped = Self::strip_tags(html);
            let cleaned = Self::clean_entities(&stripped);
            for chunk in cleaned.split("\n\n") {
                let t = chunk.trim();
                if t.len() > 5 {
                    paragraphs.push(t.to_string());
                }
            }
        }

        paragraphs
    }

    fn strip_tags(text: &str) -> String {
        let mut out = String::with_capacity(text.len());
        let mut inside_tag = false;
        for c in text.chars() {
            if c == '<' {
                inside_tag = true;
            } else if c == '>' {
                inside_tag = false;
            } else if !inside_tag {
                out.push(c);
            }
        }
        out
    }

    fn clean_entities(text: &str) -> String {
        text.replace("&mdash;", "—")
            .replace("&ndash;", "–")
            .replace("&quot;", "\"")
            .replace("&apos;", "'")
            .replace("&lsquo;", "‘")
            .replace("&rsquo;", "’")
            .replace("&ldquo;", "“")
            .replace("&rdquo;", "”")
            .replace("&amp;", "&")
            .replace("&nbsp;", " ")
    }
}
