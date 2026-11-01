use crate::core::domain::{BookMetadata, BookStorageLocation};

pub trait BookRepository {
    fn save_book(&mut self, book: BookMetadata) -> Result<(), String>;
    fn find_book_by_hash(&self, hash: &str) -> Result<Option<BookMetadata>, String>;
    fn list_books(&self) -> Result<Vec<BookMetadata>, String>;
    fn delete_book(&mut self, hash: &str) -> Result<bool, String>;

    fn add_storage_location(&mut self, location: BookStorageLocation) -> Result<(), String>;
    fn get_storage_locations(&self, book_hash: &str) -> Result<Vec<BookStorageLocation>, String>;
    fn remove_storage_location(
        &mut self,
        book_hash: &str,
        provider_id: &str,
    ) -> Result<bool, String>;
}
