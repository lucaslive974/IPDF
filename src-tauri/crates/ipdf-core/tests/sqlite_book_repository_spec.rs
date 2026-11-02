mod fakes;

use ipdf_core::adapters::persistence::SqliteBookRepository;
use ipdf_core::core::domain::{BookFormat, BookMetadata, BookStorageLocation};
use ipdf_core::core::ports::BookRepository;

#[test]
fn test_sqlite_book_repository_lifecycle() {
    let mut repo = SqliteBookRepository::new_in_memory().expect("failed to create in-memory repo");

    let book1 = BookMetadata {
        book_hash: "hash-republic".to_string(),
        title: "The Republic".to_string(),
        author: "Plato".to_string(),
        format: BookFormat::Epub,
        current_page: 15,
        total_pages: 350,
        percentage: 4.28,
        cover_image_url: Some("cover://republic.png".to_string()),
        description: Some("Foundational philosophical work on justice and state.".to_string()),
        tags: vec!["Philosophy".to_string(), "Politics".to_string()],
        last_read_at_ms: 1_700_000_100,
        updated_at_ms: 1_700_000_100,
    };

    let book2 = BookMetadata {
        book_hash: "hash-meditations".to_string(),
        title: "Meditations".to_string(),
        author: "Marcus Aurelius".to_string(),
        format: BookFormat::Pdf,
        current_page: 50,
        total_pages: 200,
        percentage: 25.0,
        cover_image_url: None,
        description: None,
        tags: vec!["Philosophy".to_string(), "Stoicism".to_string()],
        last_read_at_ms: 1_700_000_200, // Read more recently
        updated_at_ms: 1_700_000_200,
    };

    // 1. Save books
    repo.save_book(book1.clone()).unwrap();
    repo.save_book(book2.clone()).unwrap();

    // 2. Find by hash
    let found = repo
        .find_book_by_hash("hash-republic")
        .unwrap()
        .expect("book should exist");
    assert_eq!(found.title, "The Republic");
    assert_eq!(found.author, "Plato");
    assert_eq!(
        found.description.as_deref(),
        Some("Foundational philosophical work on justice and state.")
    );
    assert_eq!(found.format, BookFormat::Epub);

    let not_found = repo.find_book_by_hash("hash-nonexistent").unwrap();
    assert!(not_found.is_none());

    // 3. List books ordered by last_read_at_ms DESC
    let list = repo.list_books().unwrap();
    assert_eq!(list.len(), 2);
    assert_eq!(list[0].book_hash, "hash-meditations");
    assert_eq!(list[1].book_hash, "hash-republic");

    // 4. Update book metadata
    let mut updated_book1 = book1;
    updated_book1.title = "The Republic (Revised Edition)".to_string();
    updated_book1.current_page = 20;
    updated_book1.percentage = 5.71;
    repo.save_book(updated_book1).unwrap();

    let re_read = repo.find_book_by_hash("hash-republic").unwrap().unwrap();
    assert_eq!(re_read.title, "The Republic (Revised Edition)");
    assert_eq!(re_read.current_page, 20);

    // 5. Delete book
    let deleted = repo.delete_book("hash-meditations").unwrap();
    assert!(deleted);
    assert_eq!(repo.list_books().unwrap().len(), 1);

    let deleted_again = repo.delete_book("hash-meditations").unwrap();
    assert!(!deleted_again);
}

#[test]
fn test_sqlite_book_storage_locations() {
    let mut repo = SqliteBookRepository::new_in_memory().expect("failed to create in-memory repo");

    let book = BookMetadata {
        book_hash: "hash-ethics".to_string(),
        title: "Ethics".to_string(),
        author: "Spinoza".to_string(),
        format: BookFormat::Epub,
        current_page: 1,
        total_pages: 300,
        percentage: 0.33,
        cover_image_url: None,
        description: None,
        tags: Vec::new(),
        last_read_at_ms: 1_700_000_000,
        updated_at_ms: 1_700_000_000,
    };
    repo.save_book(book).unwrap();

    let loc_local = BookStorageLocation::new(
        "hash-ethics",
        "local_folder",
        "/books/spinoza_ethics.epub",
        true,
        Some(1_700_000_000),
    );

    let loc_remote = BookStorageLocation::new(
        "hash-ethics",
        "google_drive",
        "drive://files/ethics-spinoza-id",
        false,
        Some(1_700_000_050),
    );

    // 1. Add storage locations
    repo.add_storage_location(loc_local).unwrap();
    repo.add_storage_location(loc_remote).unwrap();

    // 2. Query locations
    let locs = repo.get_storage_locations("hash-ethics").unwrap();
    assert_eq!(locs.len(), 2);

    let local_entry = locs
        .iter()
        .find(|l| l.provider_id == "local_folder")
        .unwrap();
    assert!(local_entry.is_downloaded);
    assert_eq!(local_entry.storage_path, "/books/spinoza_ethics.epub");

    let remote_entry = locs
        .iter()
        .find(|l| l.provider_id == "google_drive")
        .unwrap();
    assert!(!remote_entry.is_downloaded);
    assert_eq!(remote_entry.storage_path, "drive://files/ethics-spinoza-id");

    // 3. Remove single storage location
    let removed = repo
        .remove_storage_location("hash-ethics", "google_drive")
        .unwrap();
    assert!(removed);
    assert_eq!(repo.get_storage_locations("hash-ethics").unwrap().len(), 1);

    // 4. Cascade delete: deleting the book deletes its storage locations
    repo.delete_book("hash-ethics").unwrap();
    assert_eq!(repo.get_storage_locations("hash-ethics").unwrap().len(), 0);

    // 5. Test open_for_platform and open_file
    use ipdf_core::adapters::platform::LinuxEnvironment;
    let temp_dir = std::env::temp_dir().join(format!("test_sqlite_book_{}", std::process::id()));
    let env = LinuxEnvironment::new(Some(temp_dir.clone()));
    let platform_repo = SqliteBookRepository::open_for_platform(&env);
    assert!(platform_repo.is_ok());
    let _ = std::fs::remove_dir_all(&temp_dir);
}

#[test]
fn test_sqlite_book_metadata_editing_and_orphan_cleanup() {
    let mut repo = SqliteBookRepository::new_in_memory().expect("failed to create in-memory repo");

    let b1 = BookMetadata {
        book_hash: "hash-critique".to_string(),
        title: "Critique of Pure Reason".to_string(),
        author: "Immanuel Kant".to_string(),
        format: BookFormat::Pdf,
        current_page: 1,
        total_pages: 500,
        percentage: 0.2,
        cover_image_url: None,
        description: Some("Epistemology magnum opus.".to_string()),
        tags: vec!["Philosophy".to_string(), "German Idealism".to_string()],
        last_read_at_ms: 1000,
        updated_at_ms: 1000,
    };

    let b2 = BookMetadata {
        book_hash: "hash-beyond".to_string(),
        title: "Beyond Good and Evil".to_string(),
        author: "Friedrich Nietzsche".to_string(),
        format: BookFormat::Epub,
        current_page: 1,
        total_pages: 250,
        percentage: 0.4,
        cover_image_url: None,
        description: None,
        tags: vec!["Philosophy".to_string(), "Existentialism".to_string()],
        last_read_at_ms: 2000,
        updated_at_ms: 2000,
    };

    repo.save_book(b1).unwrap();
    repo.save_book(b2).unwrap();

    // Check authors and tags
    let authors = repo.list_authors().unwrap();
    assert_eq!(authors, vec!["Friedrich Nietzsche", "Immanuel Kant"]);

    let tags = repo.list_tags().unwrap();
    assert_eq!(
        tags,
        vec!["Existentialism", "German Idealism", "Philosophy"]
    );

    // Update book b1: change author, change tags (remove German Idealism, add Epistemology)
    let updated = repo
        .update_book_metadata(
            "hash-critique",
            "Critique of Pure Reason (Second Edition)",
            "I. Kant",
            &["Philosophy".to_string(), "Epistemology".to_string()],
            Some("Updated description"),
        )
        .unwrap();

    assert_eq!(updated.title, "Critique of Pure Reason (Second Edition)");
    assert_eq!(updated.author, "I. Kant");
    assert_eq!(updated.description.as_deref(), Some("Updated description"));
    assert_eq!(updated.tags, vec!["Epistemology", "Philosophy"]);

    // Verify orphaned author "Immanuel Kant" was pruned and replaced by "I. Kant"
    let authors = repo.list_authors().unwrap();
    assert_eq!(authors, vec!["Friedrich Nietzsche", "I. Kant"]);

    // Verify orphaned tag "German Idealism" was pruned, "Epistemology" was added
    let tags = repo.list_tags().unwrap();
    assert_eq!(tags, vec!["Epistemology", "Existentialism", "Philosophy"]);

    // Delete book b2: should remove Nietzsche from authors and Existentialism from tags
    let deleted = repo.delete_book("hash-beyond").unwrap();
    assert!(deleted);

    let authors = repo.list_authors().unwrap();
    assert_eq!(authors, vec!["I. Kant"]);

    let tags = repo.list_tags().unwrap();
    assert_eq!(tags, vec!["Epistemology", "Philosophy"]);

    // Saving books with placeholder authors ("Local File", "Unknown", "Unknown Author") must not pollute authors
    let b3 = BookMetadata {
        book_hash: "hash-local".to_string(),
        title: "Local Document".to_string(),
        author: "Local File".to_string(),
        format: BookFormat::Pdf,
        current_page: 1,
        total_pages: 10,
        percentage: 10.0,
        cover_image_url: None,
        description: None,
        tags: vec![],
        last_read_at_ms: 3000,
        updated_at_ms: 3000,
    };
    repo.save_book(b3).unwrap();

    let b4 = BookMetadata {
        book_hash: "hash-unknown".to_string(),
        title: "Another Document".to_string(),
        author: "Unknown".to_string(),
        format: BookFormat::Epub,
        current_page: 1,
        total_pages: 10,
        percentage: 10.0,
        cover_image_url: None,
        description: None,
        tags: vec![],
        last_read_at_ms: 4000,
        updated_at_ms: 4000,
    };
    repo.save_book(b4).unwrap();

    let authors_after_placeholders = repo.list_authors().unwrap();
    assert_eq!(authors_after_placeholders, vec!["I. Kant"]);
}
