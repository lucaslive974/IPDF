use ipdf_core::core::domain::BookFormat;
use ipdf_core::core::ports::{BookRepository, ConfigurationStore, StorageProvider};
use ipdf_core::core::services::{ImportBookInput, LibraryManager};

pub const BUNDLED_REPUBLIC_EPUB: &[u8] = include_bytes!("../../assets/republic-plato.epub");
pub const INITIAL_SEED_KEY: &str = "initial_seed_completed_v1";

pub fn seed_bundled_assets_if_needed<S: StorageProvider, R: BookRepository, C: ConfigurationStore>(
    library: &mut LibraryManager<S, R>,
    config_store: &mut C,
    now_ms: i64,
) {
    if let Ok(Some(already_seeded)) = config_store.get(INITIAL_SEED_KEY) {
        if already_seeded == "true" {
            return;
        }
    }

    if let Ok(books) = library.list_books() {
        if books.is_empty() {
            let input = ImportBookInput {
                raw_bytes: BUNDLED_REPUBLIC_EPUB.to_vec(),
                title: "The Republic".to_string(),
                author: "Plato".to_string(),
                format: BookFormat::Epub,
                total_pages: 320,
                cover_image_url: None,
                now_ms,
            };
            let _ = library.import_book(input);
        }
    }

    let _ = config_store.set(INITIAL_SEED_KEY, "true");
}

#[cfg(test)]
mod tests {
    use super::*;
    use ipdf_core::adapters::configuration::SqliteConfigurationStore;
    use ipdf_core::adapters::persistence::SqliteBookRepository;
    use ipdf_core::adapters::storage::LocalFolderStorageAdapter;
    use std::env;
    use std::fs;

    #[test]
    fn test_seed_bundled_assets_first_run_and_subsequent_runs() {
        let temp_dir = env::temp_dir().join(format!("ipdf_seed_test_{}", std::process::id()));
        let _ = fs::remove_dir_all(&temp_dir);
        let storage = LocalFolderStorageAdapter::new("local-folder", &temp_dir);
        let book_repo = SqliteBookRepository::new_in_memory().unwrap();
        let mut library = LibraryManager::new_with_repo(storage, book_repo);
        let mut config_store = SqliteConfigurationStore::new_in_memory().unwrap();

        // 1. First run seeds "The Republic"
        assert_eq!(library.list_books().unwrap().len(), 0);
        seed_bundled_assets_if_needed(&mut library, &mut config_store, 1000);

        let books = library.list_books().unwrap();
        assert_eq!(books.len(), 1);
        assert_eq!(books[0].title, "The Republic");
        assert_eq!(books[0].author, "Plato");
        assert_eq!(
            config_store.get(INITIAL_SEED_KEY).unwrap(),
            Some("true".to_string())
        );

        // 2. User deletes the book
        let hash = books[0].book_hash.clone();
        assert!(library.delete_book(&hash).unwrap());
        assert_eq!(library.list_books().unwrap().len(), 0);

        // 3. Second run should NOT re-seed because INITIAL_SEED_KEY is already true
        seed_bundled_assets_if_needed(&mut library, &mut config_store, 2000);
        assert_eq!(library.list_books().unwrap().len(), 0);

        let _ = fs::remove_dir_all(&temp_dir);
    }
}
