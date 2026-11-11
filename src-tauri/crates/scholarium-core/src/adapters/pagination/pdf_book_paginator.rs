use crate::core::domain::BookPagePayload;
use crate::core::ports::BookPaginator;

#[derive(Default, Debug, Clone)]
pub struct PdfBookPaginator;

impl PdfBookPaginator {
    pub fn new() -> Self {
        Self
    }

    fn scan_pdf_page_count(bytes: &[u8]) -> u32 {
        if !bytes.starts_with(b"%PDF-") {
            let text = String::from_utf8_lossy(bytes);
            let lines_count = text.lines().filter(|l| !l.trim().is_empty()).count();
            return (lines_count.div_ceil(10) as u32).max(1);
        }

        let mut count = 0u32;
        let mut i = 0;
        let len = bytes.len();
        let pattern = b"/Type";

        while i + 10 <= len {
            if &bytes[i..i + 5] == pattern {
                let mut j = i + 5;
                while j < len
                    && (bytes[j] == b' '
                        || bytes[j] == b'\t'
                        || bytes[j] == b'\r'
                        || bytes[j] == b'\n')
                {
                    j += 1;
                }
                if j + 5 <= len && &bytes[j..j + 5] == b"/Page" {
                    let next_byte = bytes.get(j + 5).copied().unwrap_or(0);
                    if next_byte != b's' && next_byte != b'S' {
                        count += 1;
                        i = j + 5;
                        continue;
                    }
                }
            }
            i += 1;
        }

        count.max(1)
    }
}

impl BookPaginator for PdfBookPaginator {
    fn paginate(
        &self,
        raw_bytes: &[u8],
        target_total_pages: u32,
    ) -> Result<Vec<BookPagePayload>, String> {
        let is_binary_pdf = raw_bytes.starts_with(b"%PDF-");

        let total_pages = if target_total_pages > 0 {
            target_total_pages
        } else {
            Self::scan_pdf_page_count(raw_bytes)
        };

        if is_binary_pdf {
            let mut pages = Vec::with_capacity(total_pages as usize);
            for k in 1..=total_pages {
                pages.push(BookPagePayload {
                    page_number: k,
                    chapter_title: format!("Page {}", k),
                    paragraphs: vec![format!("[PDF Page {}]", k)],
                    cfi_base: format!("pdf(page={})", k),
                });
            }
            return Ok(pages);
        }

        // Text-based fallback for mocks and plain text fixtures
        let text = String::from_utf8_lossy(raw_bytes);
        let paragraphs: Vec<String> = text
            .lines()
            .map(|l| l.trim().to_string())
            .filter(|l| !l.is_empty())
            .collect();

        let mut pages = Vec::with_capacity(total_pages as usize);
        let total_paras = paragraphs.len();

        for k in 1..=total_pages {
            let start = ((k - 1) as usize * total_paras) / total_pages as usize;
            let end = (k as usize * total_paras) / total_pages as usize;
            let slice = if total_paras > 0 {
                paragraphs[start..end.max(start + 1).min(total_paras)].to_vec()
            } else {
                vec![format!("Page {}", k)]
            };

            pages.push(BookPagePayload {
                page_number: k,
                chapter_title: format!("Page {}", k),
                paragraphs: slice,
                cfi_base: format!("pdf(page={})", k),
            });
        }

        Ok(pages)
    }
}
