use crate::core::domain::BookPagePayload;
use crate::core::ports::BookPaginator;

#[derive(Default, Debug, Clone)]
pub struct EpubBookPaginator;

impl EpubBookPaginator {
    pub fn new() -> Self {
        Self
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

impl BookPaginator for EpubBookPaginator {
    fn paginate(
        &self,
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
}
