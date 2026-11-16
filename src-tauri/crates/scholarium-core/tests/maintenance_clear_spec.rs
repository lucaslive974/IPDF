use scholarium_core::adapters::configuration::SqliteConfigurationStore;
use scholarium_core::adapters::persistence::{SqliteBookRepository, SqliteHighlightRepository};
use scholarium_core::adapters::platform::LinuxEnvironment;
use scholarium_core::adapters::storage::LocalFolderStorageAdapter;
use scholarium_core::core::domain::{BookFormat, BookMetadata, Highlight, HighlightAnchor};
use scholarium_core::core::ports::{
    BookRepository, ConfigurationStore, HighlightRepository, PlatformEnvironment, StorageProvider,
};
use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

fn make_temp_root(label: &str) -> PathBuf {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let dir = std::env::temp_dir().join(format!("scholarium_{label}_{nanos}"));
    fs::create_dir_all(&dir).expect("create temp dir");
    dir
}

#[test]
fn test_subsystem_clear_methods_purge_books_covers_highlights_and_config() {
    let root = make_temp_root("maintenance_clear");
    let env = LinuxEnvironment::new(Some(root.clone()));

    let mut storage = LocalFolderStorageAdapter::for_platform("local", &env).expect("storage");
    storage.initialize().expect("init storage");
    storage
        .write_book_binary("hash-1", b"epub-bytes".to_vec(), BookFormat::Epub)
        .expect("write book");
    storage
        .write_book_cover("hash-1", b"cover-bytes", "image/webp")
        .expect("write cover");
    assert!(storage.has_book_binary("hash-1").expect("has book"));
    assert!(storage
        .read_book_cover("hash-1")
        .expect("read cover")
        .is_some());

    let mut book_repo = SqliteBookRepository::open_for_platform(&env).expect("book repo");
    book_repo
        .save_book(BookMetadata {
            book_hash: "hash-1".to_string(),
            title: "Book 1".to_string(),
            author: "Author 1".to_string(),
            format: BookFormat::Epub,
            current_page: 1,
            total_pages: 10,
            percentage: 10.0,
            description: None,
            tags: vec!["philosophy".to_string()],
            page_offset_ratio: 0.0,
            last_read_at_ms: 1000,
            updated_at_ms: 1000,
        })
        .expect("save book");
    assert_eq!(book_repo.list_books().expect("list books").len(), 1);

    let mut highlight_repo =
        SqliteHighlightRepository::open_for_platform(&env).expect("highlight repo");
    highlight_repo
        .save(Highlight::new(
            "hl-1",
            "hash-1",
            "Quote",
            "#f59e0b",
            HighlightAnchor {
                format: BookFormat::Epub,
                page_number: 1,
                epub_cfi: Some("epubcfi(/6/2!/4/2)".to_string()),
                pdf_rects: None,
            },
            "",
            1000,
        ))
        .expect("save highlight");
    assert_eq!(highlight_repo.find_all().expect("find all").len(), 1);

    let mut config_store = SqliteConfigurationStore::for_platform(&env).expect("config store");
    config_store
        .set("initial_seed_completed_v1", "true")
        .expect("set seed key");
    assert_eq!(
        config_store.get("initial_seed_completed_v1").expect("get"),
        Some("true".to_string())
    );

    // Execute subsystem .clear() calls
    highlight_repo.clear().expect("clear highlights");
    book_repo.clear().expect("clear books");
    storage.clear().expect("clear storage");
    config_store.clear().expect("clear config");

    assert!(!storage.has_book_binary("hash-1").expect("book cleared"));
    assert!(storage
        .read_book_cover("hash-1")
        .expect("cover cleared")
        .is_none());
    assert!(book_repo.list_books().expect("books empty").is_empty());
    assert!(book_repo.list_tags().expect("tags empty").is_empty());
    assert!(highlight_repo
        .find_all()
        .expect("highlights empty")
        .is_empty());
    assert_eq!(
        config_store
            .get("initial_seed_completed_v1")
            .expect("config empty"),
        None
    );
    assert!(env.books_dir().unwrap().exists());

    let _ = fs::remove_dir_all(&root);
}
