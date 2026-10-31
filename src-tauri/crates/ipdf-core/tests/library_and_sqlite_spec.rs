mod fakes;

use fakes::{InMemoryBookRepo, InMemoryStorage};
use ipdf_core::adapters::persistence::{SqliteBookRepository, SqliteHighlightRepository};
use ipdf_core::adapters::storage::LocalFolderStorageAdapter;
use ipdf_core::core::domain::{
    BookFormat, BookMetadata, BoundingBox, Highlight, HighlightAnchor, RichAnnotation,
};
use ipdf_core::core::ports::{BookRepository, HighlightRepository, StorageProvider};
use ipdf_core::core::services::{ImportBookInput, LibraryManager, Sha256BookHasher};
use std::env;
use std::fs;

#[test]
fn test_library_manager_import_progress_and_sorting() {
    let book_repo = InMemoryBookRepo::default();
    let storage = InMemoryStorage::new("local-memory");
    let mut library = LibraryManager::new(book_repo, storage);

    let raw_epub_bytes = b"PK\x03\x04epub-republic-binary-payload".to_vec();
    let expected_hash = Sha256BookHasher::hash_bytes(&raw_epub_bytes).unwrap();

    let imported = library
        .import_book(ImportBookInput {
            raw_bytes: raw_epub_bytes.clone(),
            title: "The Republic".to_string(),
            author: "Plato".to_string(),
            format: BookFormat::Epub,
            total_pages: 320,
            cover_image_url: Some("cover://republic.webp".to_string()),
            now_ms: 1000,
        })
        .unwrap();

    assert_eq!(imported.book_hash, expected_hash);
    assert_eq!(imported.current_page, 1);
    assert_eq!(imported.total_pages, 320);

    let binary = library.open_book_binary(&expected_hash).unwrap();
    assert_eq!(binary, raw_epub_bytes);

    let updated = library
        .update_reading_progress(&expected_hash, 80, 320, 2500)
        .unwrap();
    assert_eq!(updated.current_page, 80);
    assert!((updated.percentage - 25.0).abs() < f64::EPSILON);
    assert_eq!(updated.last_read_at_ms, 2500);

    // Re-importing the same binary preserves reading progress
    let reimported = library
        .import_book(ImportBookInput {
            raw_bytes: raw_epub_bytes,
            title: "The Republic (Revised Edition)".to_string(),
            author: "Plato".to_string(),
            format: BookFormat::Epub,
            total_pages: 320,
            cover_image_url: None,
            now_ms: 3000,
        })
        .unwrap();
    assert_eq!(reimported.current_page, 80);
    assert_eq!(reimported.title, "The Republic (Revised Edition)");

    // Import second book with newer timestamp and verify descending sort order
    let second_book = library
        .import_book(ImportBookInput {
            raw_bytes: b"PK\x03\x04epub-critique-pure-reason".to_vec(),
            title: "Critique of Pure Reason".to_string(),
            author: "Immanuel Kant".to_string(),
            format: BookFormat::Epub,
            total_pages: 500,
            cover_image_url: None,
            now_ms: 5000,
        })
        .unwrap();

    let all_books = library.list_books().unwrap();
    assert_eq!(all_books.len(), 2);
    assert_eq!(all_books[0].book_hash, second_book.book_hash);
    assert_eq!(all_books[1].book_hash, expected_hash);

    library.delete_book(&second_book.book_hash).unwrap();
    assert!(library.get_book(&second_book.book_hash).unwrap().is_none());
    assert!(library
        .update_reading_progress("missing-book", 1, 10, 6000)
        .is_err());
}

#[test]
fn test_sqlite_book_and_highlight_repositories() {
    let db_path = env::temp_dir().join(format!("ipdf_sqlite_test_{}.db", std::process::id()));
    let _ = fs::remove_file(&db_path);
    let _file_book_repo = SqliteBookRepository::open_file(&db_path).unwrap();
    let _file_hl_repo = SqliteHighlightRepository::open_file(&db_path).unwrap();
    let _ = fs::remove_file(&db_path);

    let mut book_repo = SqliteBookRepository::new_in_memory().unwrap();
    let mut hl_repo = SqliteHighlightRepository::new_in_memory().unwrap();

    let book = BookMetadata {
        book_hash: "sha256-ethics-spinoza".to_string(),
        title: "Ethics".to_string(),
        author: "Baruch Spinoza".to_string(),
        format: BookFormat::Epub,
        current_page: 12,
        total_pages: 240,
        percentage: 5.0,
        cover_image_url: Some("cover://spinoza.png".to_string()),
        last_read_at_ms: 10_000,
        updated_at_ms: 10_000,
    };

    book_repo.save(book.clone()).unwrap();
    let loaded_book = book_repo
        .find_by_id("sha256-ethics-spinoza")
        .unwrap()
        .expect("Book should exist in SQLite");
    assert_eq!(loaded_book, book);

    let mut updated_book = book.clone();
    updated_book.current_page = 48;
    updated_book.percentage = 20.0;
    updated_book.updated_at_ms = 20_000;
    book_repo.update(updated_book.clone()).unwrap();

    let all_books = book_repo.find_all().unwrap();
    assert_eq!(all_books.len(), 1);
    assert_eq!(all_books[0].current_page, 48);

    let mut hl = Highlight::new(
        "hl-spinoza-1",
        "sha256-ethics-spinoza",
        "Deus sive Natura",
        "#eab308",
        HighlightAnchor {
            format: BookFormat::Pdf,
            page_number: 12,
            epub_cfi: None,
            pdf_rects: Some(vec![BoundingBox {
                x: 10.0,
                y: 20.0,
                width: 100.0,
                height: 15.0,
            }]),
        },
        "Initial note",
        10_000,
    );
    hl.set_rich_annotation(
        RichAnnotation::AssistedMarkdown {
            raw_data: "**God or Nature**".to_string(),
            updated_at_ms: 11_000,
        },
        11_000,
    );
    hl.set_rich_annotation(
        RichAnnotation::Tldraw {
            raw_data: "{\"shapes\":[]}".to_string(),
            svg_preview: Some("<svg>board</svg>".to_string()),
            updated_at_ms: 11_500,
        },
        11_500,
    );

    hl_repo.save(hl.clone()).unwrap();

    let by_id = hl_repo.find_by_id("hl-spinoza-1").unwrap().unwrap();
    assert_eq!(by_id.text, "Deus sive Natura");
    assert_eq!(by_id.annotations.len(), 2);

    let by_page = hl_repo
        .find_by_book_and_page("sha256-ethics-spinoza", 12)
        .unwrap();
    assert_eq!(by_page.len(), 1);

    hl.update_note("Updated pantheism note", 15_000);
    hl_repo.update(hl).unwrap();

    let by_book = hl_repo.find_by_book("sha256-ethics-spinoza").unwrap();
    assert_eq!(by_book[0].note, "Updated pantheism note");

    hl_repo.delete("hl-spinoza-1").unwrap();
    assert!(hl_repo.find_by_id("hl-spinoza-1").unwrap().is_none());

    book_repo.delete("sha256-ethics-spinoza").unwrap();
    assert!(book_repo
        .find_by_id("sha256-ethics-spinoza")
        .unwrap()
        .is_none());
}

#[test]
fn test_local_folder_storage_adapter() {
    let temp_dir = env::temp_dir().join(format!("ipdf_storage_test_{}", std::process::id()));
    let _ = fs::remove_dir_all(&temp_dir);

    let mut adapter = LocalFolderStorageAdapter::new("local-folder", &temp_dir);
    assert!(adapter.initialize().unwrap());
    assert!(adapter.is_available());
    assert_eq!(adapter.provider_id(), "local-folder");

    assert!(!adapter.has_book_binary("hash-meditations").unwrap());
    adapter
        .write_book_binary(
            "hash-meditations",
            b"epub-bytes-marcus-aurelius".to_vec(),
            BookFormat::Epub,
        )
        .unwrap();
    assert!(adapter.has_book_binary("hash-meditations").unwrap());

    let read_bytes = adapter.read_book_binary("hash-meditations").unwrap();
    assert_eq!(read_bytes, b"epub-bytes-marcus-aurelius");

    let entry = adapter
        .write_entry(
            "hash-meditations.highlights.json",
            b"{\"highlights\":[]}",
            "application/json",
        )
        .unwrap();
    assert_eq!(entry.name, "hash-meditations.highlights.json");

    let entries = adapter.list_entries(Some("hash-meditations")).unwrap();
    assert!(!entries.is_empty());

    let entry_bytes = adapter
        .read_entry("hash-meditations.highlights.json")
        .unwrap()
        .unwrap();
    assert_eq!(entry_bytes, b"{\"highlights\":[]}");

    let _ = fs::remove_dir_all(&temp_dir);
}
