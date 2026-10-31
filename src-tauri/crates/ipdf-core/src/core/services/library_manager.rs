use crate::core::domain::{BookFormat, BookMetadata, BookPagePayload};
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
    pages_cache: BTreeMap<String, Vec<BookPagePayload>>,
    auto_bundle_assets: bool,
}

impl<S: StorageProvider> LibraryManager<S> {
    pub fn new(storage: S) -> Self {
        Self {
            storage,
            progress_map: BTreeMap::new(),
            in_memory_books: BTreeMap::new(),
            pages_cache: BTreeMap::new(),
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
            let cover_url = Self::extract_or_generate_cover(
                &[],
                "The Republic",
                "Plato",
                "Book VII — Allegory of the Cave",
            );

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
                    cover_image_url: Some(cover_url),
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
        let pages = Self::parse_and_paginate_book(&input.raw_bytes, input.total_pages)?;
        let total_pages = (pages.len() as u32).max(1);
        self.pages_cache.insert(book_hash.clone(), pages.clone());

        let existing = self.progress_map.get(&book_hash).cloned();

        let (current_page, percentage) = match existing {
            Some(ref p) => (p.current_page.clamp(1, total_pages), p.percentage),
            None => (1, ((1.0 / total_pages as f64) * 100.0).clamp(0.0, 100.0)),
        };

        let first_page_title = pages
            .first()
            .map(|p| p.chapter_title.as_str())
            .unwrap_or("Chapter 1");

        let cover_image_url = if let Some(ref url) = input.cover_image_url {
            if !url.is_empty() {
                Some(url.clone())
            } else {
                Some(Self::extract_or_generate_cover(
                    &input.raw_bytes,
                    &input.title,
                    &input.author,
                    first_page_title,
                ))
            }
        } else {
            Some(Self::extract_or_generate_cover(
                &input.raw_bytes,
                &input.title,
                &input.author,
                first_page_title,
            ))
        };

        let progress = ReadingProgress {
            title: input.title.clone(),
            author: input.author.clone(),
            format: input.format,
            current_page,
            total_pages,
            percentage,
            last_read_at_ms: input.now_ms,
            cover_image_url: cover_image_url.clone(),
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
            cover_image_url,
            last_read_at_ms: input.now_ms,
            updated_at_ms: input.now_ms,
        })
    }

    pub fn list_books(&mut self) -> Result<Vec<BookMetadata>, String> {
        self.load_progress_cache()?;

        if self.auto_bundle_assets && !self.progress_map.contains_key(DEFAULT_ASSET_HASH) {
            let cover_url = Self::extract_or_generate_cover(
                &[],
                "The Republic",
                "Plato",
                "Book VII — Allegory of the Cave",
            );

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
                    cover_image_url: Some(cover_url),
                    file_path: None,
                },
            );
        }

        let mut books = Vec::new();
        for (book_hash, progress) in &self.progress_map {
            let cover_url = progress.cover_image_url.clone().or_else(|| {
                Some(Self::extract_or_generate_cover(
                    &[],
                    &progress.title,
                    &progress.author,
                    "Page 1",
                ))
            });

            books.push(BookMetadata {
                book_hash: book_hash.clone(),
                title: progress.title.clone(),
                author: progress.author.clone(),
                format: progress.format,
                current_page: progress.current_page,
                total_pages: progress.total_pages,
                percentage: progress.percentage,
                cover_image_url: cover_url,
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

        let pages = Self::parse_and_paginate_book(&bytes, 0)?;
        let total_pages = (pages.len() as u32).max(1);
        self.pages_cache.insert(book_hash.clone(), pages.clone());

        let existing = self.progress_map.get(&book_hash).cloned();

        let (current_page, percentage) = match existing {
            Some(ref p) => (p.current_page.clamp(1, total_pages), p.percentage),
            None => (1, 1.0),
        };

        let now_ms = 0;
        let first_page_title = pages
            .first()
            .map(|p| p.chapter_title.as_str())
            .unwrap_or("Chapter 1");
        let cover_url =
            Self::extract_or_generate_cover(&bytes, &stem, "Local File", first_page_title);

        let progress = ReadingProgress {
            title: stem.clone(),
            author: "Local File".to_string(),
            format,
            current_page,
            total_pages,
            percentage,
            last_read_at_ms: now_ms,
            cover_image_url: Some(cover_url.clone()),
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
            cover_image_url: Some(cover_url),
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

    pub fn get_book_pages(
        &mut self,
        book_hash: &str,
        start_page: u32,
        count: u32,
    ) -> Result<Vec<BookPagePayload>, String> {
        if !self.pages_cache.contains_key(book_hash) {
            let raw_bytes = self.open_book_binary(book_hash)?;
            let total_pages = self
                .progress_map
                .get(book_hash)
                .map(|p| p.total_pages)
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

    pub fn extract_or_generate_cover(
        raw_bytes: &[u8],
        title: &str,
        author: &str,
        first_page_subtitle: &str,
    ) -> String {
        if raw_bytes.len() > 30 && raw_bytes.starts_with(b"PK\x03\x04") {
            let cursor = std::io::Cursor::new(raw_bytes);
            if let Ok(mut archive) = zip::ZipArchive::new(cursor) {
                for i in 0..archive.len() {
                    if let Ok(mut file) = archive.by_index(i) {
                        let Ok(file_name) = file.name() else {
                            continue;
                        };
                        let lower = file_name.to_lowercase();
                        let is_cover_img = lower.contains("cover")
                            && (lower.ends_with(".png")
                                || lower.ends_with(".jpg")
                                || lower.ends_with(".jpeg")
                                || lower.ends_with(".webp"));

                        if is_cover_img {
                            use base64::Engine;
                            use std::io::Read;
                            let mut buffer = Vec::new();
                            if file.read_to_end(&mut buffer).is_ok() && !buffer.is_empty() {
                                let mime = if lower.ends_with(".png") {
                                    "image/png"
                                } else if lower.ends_with(".webp") {
                                    "image/webp"
                                } else {
                                    "image/jpeg"
                                };
                                let encoded =
                                    base64::engine::general_purpose::STANDARD.encode(&buffer);
                                return format!("data:{};base64,{}", mime, encoded);
                            }
                        }
                    }
                }
            }
        }

        Self::generate_svg_cover(title, author, first_page_subtitle)
    }

    pub fn generate_svg_cover(title: &str, author: &str, subtitle: &str) -> String {
        let safe_title = Self::escape_xml(title);
        let safe_author = Self::escape_xml(author);
        let safe_subtitle = Self::escape_xml(subtitle);

        let svg = format!(
            r##"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 600" width="100%" height="100%">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1e293b"/>
      <stop offset="50%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#020617"/>
    </linearGradient>
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#fbbf24"/>
      <stop offset="100%" stop-color="#d97706"/>
    </linearGradient>
  </defs>
  <rect width="400" height="600" rx="8" fill="url(#bgGrad)"/>
  <rect x="0" y="0" width="24" height="600" fill="rgba(255,255,255,0.06)"/>
  <line x1="24" y1="0" x2="24" y2="600" stroke="rgba(255,255,255,0.12)" stroke-width="2"/>
  <rect x="36" y="28" width="338" height="544" rx="4" fill="none" stroke="url(#goldGrad)" stroke-width="2"/>
  <rect x="42" y="34" width="326" height="532" rx="2" fill="none" stroke="rgba(251,191,36,0.35)" stroke-width="1"/>
  <text x="205" y="85" text-anchor="middle" fill="#94a3b8" font-family="sans-serif" font-size="11" font-weight="bold" letter-spacing="3">IPDF ACTIVE STUDY EDITION</text>
  <line x1="120" y1="100" x2="290" y2="100" stroke="#fbbf24" stroke-width="1"/>
  <text x="205" y="190" text-anchor="middle" fill="#f8fafc" font-family="serif" font-size="26" font-weight="bold">{}</text>
  <text x="205" y="235" text-anchor="middle" fill="#cbd5e1" font-family="serif" font-size="14" font-style="italic">{}</text>
  <circle cx="205" cy="350" r="28" fill="none" stroke="#fbbf24" stroke-width="1.5"/>
  <text x="205" y="358" text-anchor="middle" fill="#fbbf24" font-family="serif" font-size="22">❦</text>
  <text x="205" y="440" text-anchor="middle" fill="#f1f5f9" font-family="serif" font-size="18" font-weight="600" letter-spacing="1">{}</text>
  <line x1="140" y1="475" x2="270" y2="475" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
  <text x="205" y="520" text-anchor="middle" fill="#64748b" font-family="sans-serif" font-size="10" letter-spacing="2">ACTIVE STUDY READER</text>
</svg>"##,
            safe_title, safe_subtitle, safe_author
        );

        use base64::Engine;
        let encoded = base64::engine::general_purpose::STANDARD.encode(svg.as_bytes());
        format!("data:image/svg+xml;base64,{}", encoded)
    }

    fn escape_xml(s: &str) -> String {
        s.replace('&', "&amp;")
            .replace('<', "&lt;")
            .replace('>', "&gt;")
            .replace('"', "&quot;")
            .replace('\'', "&apos;")
    }
}
