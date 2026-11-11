mod fakes;

use fakes::InMemoryStorage;
use scholarium_core::adapters::persistence::SqliteHighlightRepository;
use scholarium_core::adapters::storage::LocalFolderStorageAdapter;
use scholarium_core::core::domain::{
    BookFormat, BoundingBox, Highlight, HighlightAnchor, RichAnnotation,
};
use scholarium_core::core::ports::{BookRepository, HighlightRepository, StorageProvider};
use scholarium_core::core::services::{ImportBookInput, LibraryManager, Sha256BookHasher};
use std::env;
use std::fs;

#[test]
fn test_library_manager_import_progress_and_sorting() {
    let storage = InMemoryStorage::new("local-memory");
    let mut library = LibraryManager::new(storage);
    assert!(library.initialize().unwrap());

    // Fresh library starts with 0 books
    let initial_books = library.list_books().unwrap();
    assert_eq!(initial_books.len(), 0);

    let raw_epub_bytes = b"PK\x03\x04epub-republic-binary-payload".to_vec();
    let expected_hash = Sha256BookHasher::hash_bytes(&raw_epub_bytes).unwrap();

    let imported = library
        .import_book(ImportBookInput {
            raw_bytes: raw_epub_bytes.clone(),
            title: "The Republic (User Edition)".to_string(),
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
    assert!(library.storage().has_book_binary(&expected_hash).unwrap());

    let updated = library
        .update_reading_progress(&expected_hash, 80, 320, 0.45, 2500)
        .unwrap();
    assert_eq!(updated.current_page, 80);
    assert!((updated.percentage - 25.0).abs() < f64::EPSILON);
    assert_eq!(updated.page_offset_ratio, 0.45);
    assert_eq!(updated.last_read_at_ms, 2500);

    // Re-importing the same binary preserves reading progress
    let reimported = library
        .import_book(ImportBookInput {
            raw_bytes: raw_epub_bytes,
            title: "The Republic (Revised Edition)".to_string(),
            author: "Plato".to_string(),
            format: BookFormat::Epub,
            total_pages: 320,
            cover_image_url: Some("cover://republic.webp".to_string()),
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
    assert_eq!(all_books[0].cover_image_url, None);
    assert_eq!(
        all_books[1].cover_image_url,
        Some("cover://republic.webp".to_string())
    );

    // Direct filesystem opening (System handler / Open with / Default app)
    let temp_file = env::temp_dir().join(format!("external_book_{}.epub", std::process::id()));
    fs::write(&temp_file, b"PK\x03\x04external-standalone-file").unwrap();

    let (opened_meta, opened_bytes) = library.open_book_from_path(&temp_file).unwrap();
    assert_eq!(opened_bytes, b"PK\x03\x04external-standalone-file");
    assert_eq!(opened_meta.format, BookFormat::Epub);

    let _ = fs::remove_file(&temp_file);
    assert!(library
        .open_book_from_path(&std::path::PathBuf::from("/nonexistent/file.epub"))
        .is_err());

    // Batch filesystem opening (multiple files)
    let temp_file_1 = env::temp_dir().join(format!("batch_book_1_{}.epub", std::process::id()));
    let temp_file_2 = env::temp_dir().join(format!("batch_book_2_{}.pdf", std::process::id()));
    fs::write(&temp_file_1, b"PK\x03\x04batch-epub").unwrap();
    fs::write(&temp_file_2, b"%PDF-1.4 batch-pdf").unwrap();

    let batch_results = library.open_books_from_paths(&[&temp_file_1, &temp_file_2]);
    assert_eq!(batch_results.len(), 2);
    assert!(batch_results[0].is_ok());
    assert!(batch_results[1].is_ok());
    assert_eq!(
        batch_results[0].as_ref().unwrap().0.format,
        BookFormat::Epub
    );
    assert_eq!(batch_results[1].as_ref().unwrap().0.format, BookFormat::Pdf);

    let _ = fs::remove_file(&temp_file_1);
    let _ = fs::remove_file(&temp_file_2);
}

#[test]
fn test_sqlite_highlight_repository() {
    let db_path = env::temp_dir().join(format!("scholarium_sqlite_test_{}.db", std::process::id()));
    let _ = fs::remove_file(&db_path);
    let _file_hl_repo = SqliteHighlightRepository::open_file(&db_path).unwrap();
    let _ = fs::remove_file(&db_path);

    let mut hl_repo = SqliteHighlightRepository::new_in_memory().unwrap();

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

    hl_repo.save(hl.clone()).unwrap();

    let all_highlights = hl_repo.find_all().unwrap();
    assert_eq!(all_highlights.len(), 1);
    assert_eq!(all_highlights[0].id, "hl-spinoza-1");

    let by_id = hl_repo.find_by_id("hl-spinoza-1").unwrap().unwrap();
    assert_eq!(by_id.text, "Deus sive Natura");
    assert_eq!(by_id.annotations.len(), 1);

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
}

#[test]
fn test_local_folder_storage_adapter() {
    let temp_dir = env::temp_dir().join(format!("scholarium_storage_test_{}", std::process::id()));
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

    // Test rename_entry success and error
    adapter
        .rename_entry(
            "hash-meditations.highlights.json",
            "hash-meditations.renamed.json",
        )
        .unwrap();
    assert!(adapter
        .read_entry("hash-meditations.highlights.json")
        .unwrap()
        .is_none());
    assert_eq!(
        adapter
            .read_entry("hash-meditations.renamed.json")
            .unwrap()
            .unwrap(),
        b"{\"highlights\":[]}"
    );

    assert!(adapter
        .rename_entry("nonexistent.json", "target.json")
        .is_err());

    let _ = fs::remove_dir_all(&temp_dir);
}

#[test]
fn test_library_manager_and_reader_get_book_pages_on_demand() {
    use fakes::InMemoryBookRepo;
    use scholarium_core::core::services::ReaderManager;

    let storage = InMemoryStorage::new("local-memory");
    let book_repo = InMemoryBookRepo::default();
    let mut library = LibraryManager::new_with_repo(storage.clone(), book_repo);
    library.initialize().unwrap();

    let raw_bytes = b"<html><head><title>Test Book</title></head><body><h1>Chapter 1</h1><p>First paragraph here</p><p>Second paragraph here</p></body></html>".to_vec();
    let imported = library
        .import_book(ImportBookInput {
            raw_bytes,
            title: "Test Book".to_string(),
            author: "Author".to_string(),
            format: BookFormat::Epub,
            total_pages: 10,
            cover_image_url: None,
            now_ms: 1000,
        })
        .unwrap();

    let mut reader =
        ReaderManager::new_with_repo(library.storage().clone(), library.book_repo().clone());

    let pages = reader.get_book_pages(&imported.book_hash, 1, 5).unwrap();
    assert_eq!(pages.len(), 5);
    assert_eq!(pages[0].page_number, 1);
    assert_eq!(pages[4].page_number, 5);
    assert!(!pages[0].paragraphs.is_empty());
    assert_eq!(pages[0].chapter_title, "Chapter 1");

    let last_pages = reader.get_book_pages(&imported.book_hash, 9, 5).unwrap();
    assert_eq!(last_pages.len(), 2);
    assert_eq!(last_pages[1].page_number, 10);

    // Out of range
    let empty = reader.get_book_pages(&imported.book_hash, 50, 5).unwrap();
    assert!(empty.is_empty());
}

#[test]
fn test_library_manager_rename_book_preserves_highlights() {
    let storage = InMemoryStorage::new("local-memory");
    let mut library = LibraryManager::new(storage);
    library.initialize().unwrap();

    let mut sqlite_repo = SqliteHighlightRepository::new_in_memory().unwrap();

    let raw_bytes = b"PK\x03\x04epub-clean-code-content".to_vec();
    let imported = library
        .import_book(ImportBookInput {
            raw_bytes,
            title: "Original Draft Title".to_string(),
            author: "Robert C. Martin".to_string(),
            format: BookFormat::Epub,
            total_pages: 450,
            cover_image_url: None,
            now_ms: 10_000,
        })
        .unwrap();

    let hash = imported.book_hash.clone();
    assert_eq!(imported.title, "Original Draft Title");

    // Add highlights for this book
    let hl1 = Highlight::new(
        "hl-1",
        &hash,
        "Clean code reads like well-written prose.",
        "#22c55e",
        HighlightAnchor {
            format: BookFormat::Epub,
            page_number: 15,
            epub_cfi: Some("epubcfi(/6/4[chap1]!/4/2/10:0)".to_string()),
            pdf_rects: None,
        },
        "Key insight on readability",
        10_500,
    );
    let hl2 = Highlight::new(
        "hl-2",
        &hash,
        "Leave the campground cleaner than you found it.",
        "#3b82f6",
        HighlightAnchor {
            format: BookFormat::Epub,
            page_number: 18,
            epub_cfi: Some("epubcfi(/6/4[chap1]!/4/2/25:0)".to_string()),
            pdf_rects: None,
        },
        "Boy scout rule",
        11_000,
    );

    sqlite_repo.save(hl1).unwrap();
    sqlite_repo.save(hl2).unwrap();

    // Verify initial highlights count
    let initial_hls = sqlite_repo.find_by_book(&hash).unwrap();
    assert_eq!(initial_hls.len(), 2);

    // Rename the book
    let renamed = library
        .rename_book(&hash, "Clean Code: A Handbook")
        .unwrap();
    assert_eq!(renamed.book_hash, hash);
    assert_eq!(renamed.title, "Clean Code: A Handbook");

    // Verify metadata updated in list_books
    let current_meta = library.get_book(&hash).unwrap().unwrap();
    assert_eq!(current_meta.title, "Clean Code: A Handbook");

    // CRITICAL: Highlights remain 100% intact because book_hash is unchanged
    let preserved_hls = sqlite_repo.find_by_book(&hash).unwrap();
    assert_eq!(preserved_hls.len(), 2);
    assert_eq!(preserved_hls[0].id, "hl-1");
    assert_eq!(
        preserved_hls[0].text,
        "Clean code reads like well-written prose."
    );
    assert_eq!(preserved_hls[0].note, "Key insight on readability");
    assert_eq!(preserved_hls[1].id, "hl-2");
    assert_eq!(
        preserved_hls[1].text,
        "Leave the campground cleaner than you found it."
    );

    // Validation: empty or whitespace title fails
    assert!(library.rename_book(&hash, "").is_err());
    assert!(library.rename_book(&hash, "   \n\t  ").is_err());

    // Validation: nonexistent hash fails
    assert!(library
        .rename_book("nonexistent-hash", "New Title")
        .is_err());
}

#[test]
fn test_library_manager_and_sqlite_delete_book_cascades() {
    let storage = InMemoryStorage::new("local-memory");
    let mut library = LibraryManager::new(storage);
    library.initialize().unwrap();

    let mut sqlite_repo = SqliteHighlightRepository::new_in_memory().unwrap();

    // 1. Import book
    let imported = library
        .import_book(ImportBookInput {
            raw_bytes: b"Dummy book content".to_vec(),
            title: "To Be Deleted".to_string(),
            author: "Anonymous".to_string(),
            format: BookFormat::Epub,
            total_pages: 50,
            cover_image_url: None,
            now_ms: 1000,
        })
        .unwrap();

    let book_hash = imported.book_hash;

    // 2. Add highlights to SQLite
    let hl1 = Highlight::new(
        "hl-del-1",
        &book_hash,
        "Passage to be removed",
        "#FFEB3B",
        HighlightAnchor {
            format: BookFormat::Epub,
            page_number: 1,
            epub_cfi: Some("epubcfi(/6/2!/4/2)".to_string()),
            pdf_rects: None,
        },
        "Note 1",
        1000,
    );
    let hl2 = Highlight::new(
        "hl-del-2",
        &book_hash,
        "Another passage to be removed",
        "#4CAF50",
        HighlightAnchor {
            format: BookFormat::Epub,
            page_number: 2,
            epub_cfi: Some("epubcfi(/6/4!/4/2)".to_string()),
            pdf_rects: None,
        },
        "Note 2",
        1000,
    );
    sqlite_repo.save(hl1).unwrap();
    sqlite_repo.save(hl2).unwrap();

    assert_eq!(sqlite_repo.find_by_book(&book_hash).unwrap().len(), 2);
    assert!(library.get_book(&book_hash).unwrap().is_some());

    // 3. Cascade deletion: delete highlights and book
    let deleted_hls = sqlite_repo.delete_by_book(&book_hash).unwrap();
    assert_eq!(deleted_hls, 2);
    assert_eq!(sqlite_repo.find_by_book(&book_hash).unwrap().len(), 0);

    let deleted_book = library.delete_book(&book_hash).unwrap();
    assert!(deleted_book);
    assert!(library.get_book(&book_hash).unwrap().is_none());

    // Book is not listed anymore
    let all_books = library.list_books().unwrap();
    assert!(!all_books.iter().any(|b| b.book_hash == book_hash));
}

#[test]
fn test_library_manager_with_sqlite_book_repo_integration() {
    use fakes::InMemoryBookRepo;
    use scholarium_core::core::ports::BookRepository;

    let storage = InMemoryStorage::new("local-storage");
    let book_repo = InMemoryBookRepo::default();

    let mut library = LibraryManager::new_with_repo(storage, book_repo);
    assert!(library.initialize().unwrap());

    // 1. Initial list starts empty
    let initial_books = library.list_books().unwrap();
    assert_eq!(initial_books.len(), 0);
    assert_eq!(library.book_repo().list_books().unwrap().len(), 0);

    // 2. Import book
    let raw_bytes = b"sample epub bytes".to_vec();
    let imported = library
        .import_book(ImportBookInput {
            raw_bytes,
            title: "Phaedo".to_string(),
            author: "Plato".to_string(),
            format: BookFormat::Epub,
            total_pages: 180,
            cover_image_url: None,
            now_ms: 5000,
        })
        .unwrap();

    let hash = imported.book_hash;
    // Check book was saved in repo
    let repo_book = library
        .book_repo()
        .find_book_by_hash(&hash)
        .unwrap()
        .expect("should exist in book repo");
    assert_eq!(repo_book.title, "Phaedo");

    // Check storage location was registered
    let locs = library.book_repo().get_storage_locations(&hash).unwrap();
    assert_eq!(locs.len(), 1);
    assert_eq!(locs[0].provider_id, "local-storage");
    assert!(locs[0].is_downloaded);

    // 3. Rename book and update metadata
    let renamed = library
        .rename_book(&hash, "Phaedo on the Immortality of the Soul")
        .unwrap();
    assert_eq!(renamed.title, "Phaedo on the Immortality of the Soul");
    let repo_renamed = library
        .book_repo()
        .find_book_by_hash(&hash)
        .unwrap()
        .unwrap();
    assert_eq!(repo_renamed.title, "Phaedo on the Immortality of the Soul");

    // 3b. Update full metadata via LibraryManager
    let updated_meta = library
        .update_book_metadata(
            &hash,
            "Phaedo Dialogues",
            "Plato of Athens",
            &["Ancient Philosophy".to_string(), "Soul".to_string()],
            Some("A dialogue on immortality."),
        )
        .unwrap();
    assert_eq!(updated_meta.title, "Phaedo Dialogues");
    assert_eq!(updated_meta.author, "Plato of Athens");
    assert_eq!(updated_meta.tags, vec!["Ancient Philosophy", "Soul"]);
    assert_eq!(
        updated_meta.description.as_deref(),
        Some("A dialogue on immortality.")
    );

    let authors = library.list_authors().unwrap();
    assert_eq!(authors, vec!["Plato of Athens"]);

    let tags = library.list_tags().unwrap();
    assert_eq!(tags, vec!["Ancient Philosophy", "Soul"]);

    // 4. Update progress
    let updated = library
        .update_reading_progress(&hash, 90, 180, 0.75, 8000)
        .unwrap();
    assert_eq!(updated.current_page, 90);
    assert_eq!(updated.percentage, 50.0);
    assert_eq!(updated.page_offset_ratio, 0.75);
    let repo_prog = library
        .book_repo()
        .find_book_by_hash(&hash)
        .unwrap()
        .unwrap();
    assert_eq!(repo_prog.current_page, 90);
    assert_eq!(repo_prog.page_offset_ratio, 0.75);

    // 4.1 Clamping extremes and negative support for page_offset_ratio
    let valid_neg = library
        .update_reading_progress(&hash, 90, 180, -0.35, 8200)
        .unwrap();
    assert_eq!(valid_neg.page_offset_ratio, -0.35);

    let clamped_neg = library
        .update_reading_progress(&hash, 90, 180, -10.0, 8500)
        .unwrap();
    assert_eq!(clamped_neg.page_offset_ratio, -1.0);

    let clamped_over = library
        .update_reading_progress(&hash, 90, 180, 150.0, 9000)
        .unwrap();
    assert_eq!(clamped_over.page_offset_ratio, 1.0);

    // 5. Delete book
    let deleted = library.delete_book(&hash).unwrap();
    assert!(deleted);
    assert!(library
        .book_repo()
        .find_book_by_hash(&hash)
        .unwrap()
        .is_none());

    // 6. Test open_book_from_path with repo
    let temp_book_path =
        std::env::temp_dir().join(format!("test_repo_book_{}.epub", std::process::id()));
    std::fs::write(&temp_book_path, b"dummy epub content").unwrap();
    let (opened_meta, _bytes) = library.open_book_from_path(&temp_book_path).unwrap();
    assert_eq!(
        opened_meta.title,
        temp_book_path.file_stem().unwrap().to_str().unwrap()
    );
    let _ = std::fs::remove_file(&temp_book_path);
}

#[test]
fn test_library_manager_zip_epub_and_open_binary_fallbacks() {
    use fakes::InMemoryBookRepo;
    use scholarium_core::core::domain::{BookMetadata, BookStorageLocation};
    use scholarium_core::core::ports::BookRepository;
    use std::io::Write;

    let storage = InMemoryStorage::new("local-memory");
    let book_repo = InMemoryBookRepo::default();
    let mut library = LibraryManager::new_with_repo(storage, book_repo);
    library.initialize().unwrap();

    let _ = library.storage_mut();
    let _ = library.book_repo_mut();

    // Create a real minimal zip archive simulating an epub with an xhtml chapter
    let mut zip_bytes = Vec::new();
    {
        let cursor = std::io::Cursor::new(&mut zip_bytes);
        let mut zip = zip::ZipWriter::new(cursor);
        let options = zip::write::SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Stored);
        zip.start_file("chapter1.xhtml", options).unwrap();
        let content = "<html><head><title>Zip Title &mdash; Sub</title></head><body><h1>Chapter Header</h1><p>First paragraph with &ldquo;quotes&rdquo; and &apos;single&apos;.</p><p>Second paragraph with &amp; ampersand.</p></body></html>";
        zip.write_all(content.as_bytes()).unwrap();
        zip.finish().unwrap();
    }

    let imported = library
        .import_book(ImportBookInput {
            raw_bytes: zip_bytes.clone(),
            title: "Zip Book".to_string(),
            author: "Zip Author".to_string(),
            format: BookFormat::Epub,
            total_pages: 5,
            cover_image_url: None,
            now_ms: 1000,
        })
        .unwrap();

    // Test open_book_binary fallbacks:
    // 1. Reading from storage when in-memory cache is purged
    let mut library2 =
        LibraryManager::new_with_repo(library.storage().clone(), library.book_repo().clone());
    let bytes = library2.open_book_binary(&imported.book_hash).unwrap();
    assert_eq!(bytes, zip_bytes);

    // 2. Reading from storage location on filesystem
    let temp_file = env::temp_dir().join(format!("loc_test_{}.epub", std::process::id()));
    fs::write(&temp_file, b"direct-fs-bytes").unwrap();
    let loc_book_hash = "hash-direct-loc";
    library2
        .book_repo_mut()
        .save_book(BookMetadata {
            book_hash: loc_book_hash.to_string(),
            title: "Direct Loc".to_string(),
            author: "Author".to_string(),
            format: BookFormat::Epub,
            current_page: 1,
            total_pages: 10,
            percentage: 10.0,
            cover_image_url: None,
            description: None,
            tags: Vec::new(),
            page_offset_ratio: 0.0,
            last_read_at_ms: 1000,
            updated_at_ms: 1000,
        })
        .unwrap();
    library2
        .book_repo_mut()
        .add_storage_location(BookStorageLocation::new(
            loc_book_hash,
            "local-fs",
            temp_file.to_string_lossy().to_string(),
            true,
            Some(1000),
        ))
        .unwrap();

    let loc_bytes = library2.open_book_binary(loc_book_hash).unwrap();
    assert_eq!(loc_bytes, b"direct-fs-bytes");
    let _ = fs::remove_file(&temp_file);

    // 3. Error on completely nonexistent hash
    assert!(library2.open_book_binary("nonexistent-hash-xyz").is_err());
}

#[test]
fn test_library_manager_update_book_cover() {
    let storage = InMemoryStorage::new("local-memory");
    let mut library = LibraryManager::new(storage);
    library.initialize().unwrap();

    let raw_bytes = b"%PDF-1.4-dummy-pdf-content".to_vec();
    let imported = library
        .import_book(ImportBookInput {
            raw_bytes,
            title: "PDF Without Cover".to_string(),
            author: "Author".to_string(),
            format: BookFormat::Pdf,
            total_pages: 50,
            cover_image_url: None,
            now_ms: 1000,
        })
        .unwrap();

    assert!(imported.cover_image_url.is_none());

    let webp_data_url = "data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==";
    let updated = library
        .update_book_cover(&imported.book_hash, webp_data_url, 2000)
        .unwrap();

    assert_eq!(
        updated.cover_image_url,
        Some("covers/".to_string() + &imported.book_hash + ".webp")
    );
    assert_eq!(updated.updated_at_ms, 2000);

    // Verify retrieval from repo
    let fetched = library
        .book_repo()
        .find_book_by_hash(&imported.book_hash)
        .unwrap()
        .unwrap();
    assert_eq!(
        fetched.cover_image_url,
        Some("covers/".to_string() + &imported.book_hash + ".webp")
    );

    // Verify non-existent book returns Err
    assert!(library
        .update_book_cover("unknown-hash", webp_data_url, 3000)
        .is_err());
}
