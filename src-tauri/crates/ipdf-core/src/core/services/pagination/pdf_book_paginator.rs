use crate::core::domain::BookPagePayload;
use crate::core::ports::BookPaginator;

#[derive(Default, Debug, Clone)]
pub struct PdfBookPaginator;

impl PdfBookPaginator {
    pub fn new() -> Self {
        Self
    }
}

impl BookPaginator for PdfBookPaginator {
    fn paginate(
        &self,
        raw_bytes: &[u8],
        target_total_pages: u32,
    ) -> Result<Vec<BookPagePayload>, String> {
        let text = String::from_utf8_lossy(raw_bytes);
        let paragraphs: Vec<String> = text
            .lines()
            .map(|l| l.trim().to_string())
            .filter(|l| !l.is_empty())
            .collect();

        let total_pages = if target_total_pages > 0 {
            target_total_pages
        } else {
            (paragraphs.len().div_ceil(10)).max(1) as u32
        };

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
