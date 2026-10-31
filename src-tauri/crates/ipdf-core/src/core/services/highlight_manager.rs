use crate::core::domain::{Highlight, HighlightAnchor};
use crate::core::ports::HighlightRepository;
use std::collections::BTreeMap;

pub struct CreateHighlightInput {
    pub id: String,
    pub book_hash: String,
    pub text: String,
    pub color: String,
    pub anchor: HighlightAnchor,
    pub note: String,
    pub timestamp_ms: i64,
}

pub struct HighlightManager<R: HighlightRepository> {
    repository: R,
    cache: BTreeMap<String, Highlight>,
}

impl<R: HighlightRepository> HighlightManager<R> {
    pub fn new(repository: R) -> Self {
        Self {
            repository,
            cache: BTreeMap::new(),
        }
    }

    pub fn load_book_highlights(&mut self, book_hash: &str) -> Result<Vec<Highlight>, String> {
        self.cache.clear();
        let highlights = self.repository.find_by_book(book_hash)?;
        for hl in &highlights {
            self.cache.insert(hl.id.clone(), hl.clone());
        }
        Ok(highlights)
    }

    pub fn create_highlight(&mut self, input: CreateHighlightInput) -> Result<Highlight, String> {
        let hl = Highlight::new(
            input.id,
            input.book_hash,
            input.text,
            input.color,
            input.anchor,
            input.note,
            input.timestamp_ms,
        );
        self.repository.save(hl.clone())?;
        self.cache.insert(hl.id.clone(), hl.clone());
        Ok(hl)
    }

    pub fn get_for_page(&self, page_number: u32) -> Vec<Highlight> {
        self.cache
            .values()
            .filter(|h| h.anchor.page_number == page_number)
            .cloned()
            .collect()
    }

    pub fn repository_mut(&mut self) -> &mut R {
        &mut self.repository
    }
}
