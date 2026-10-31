use crate::core::domain::{BookMetadata, Highlight};

pub trait BookRepository {
    fn save(&mut self, book: BookMetadata) -> Result<(), String>;
    fn find_by_id(&self, book_hash: &str) -> Result<Option<BookMetadata>, String>;
    fn update(&mut self, book: BookMetadata) -> Result<(), String>;
    fn delete(&mut self, book_hash: &str) -> Result<(), String>;
    fn find_all(&self) -> Result<Vec<BookMetadata>, String>;
}

pub trait HighlightRepository {
    fn save(&mut self, highlight: Highlight) -> Result<(), String>;
    fn find_by_id(&self, id: &str) -> Result<Option<Highlight>, String>;
    fn update(&mut self, highlight: Highlight) -> Result<(), String>;
    fn delete(&mut self, id: &str) -> Result<(), String>;
    fn find_by_book(&self, book_hash: &str) -> Result<Vec<Highlight>, String>;
    fn find_by_book_and_page(
        &self,
        book_hash: &str,
        page_number: u32,
    ) -> Result<Vec<Highlight>, String>;
}
