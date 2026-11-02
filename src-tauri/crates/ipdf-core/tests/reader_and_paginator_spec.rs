mod fakes;

use fakes::{InMemoryBookRepo, InMemoryStorage};
use ipdf_core::adapters::pagination::{BookPaginatorFactory, EpubBookPaginator, PdfBookPaginator};
use ipdf_core::core::domain::{BookFormat, BookMetadata, BookStorageLocation};
use ipdf_core::core::ports::{BookPaginator, BookRepository, StorageProvider};
use ipdf_core::core::services::ReaderManager;
use std::env;
use std::fs;
use std::io::Write;

#[test]
fn test_epub_and_pdf_paginators() {
    // 1. EPUB Paginator with minimal ZIP containing XHTML chapter
    let epub_paginator = EpubBookPaginator::new();
    let mut zip_bytes = Vec::new();
    {
        let cursor = std::io::Cursor::new(&mut zip_bytes);
        let mut zip = zip::ZipWriter::new(cursor);
        let options = zip::write::SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Stored);
        zip.start_file("content.xhtml", options).unwrap();
        let html = "<html><head><title>Chapter 1 &mdash; Start</title></head><body><h1>Main Title</h1><p>Paragraph &ldquo;one&rdquo; with &apos;single&apos; quotes.</p><p>Paragraph two &amp; more.</p></body></html>";
        zip.write_all(html.as_bytes()).unwrap();
        zip.finish().unwrap();
    }

    let epub_pages = epub_paginator.paginate(&zip_bytes, 4).unwrap();
    assert_eq!(epub_pages.len(), 4);
    assert_eq!(epub_pages[0].page_number, 1);
    assert_eq!(epub_pages[0].chapter_title, "Chapter 1 — Start");
    assert!(epub_pages[0].cfi_base.starts_with("epubcfi("));

    // Fallback: plain text with no zip
    let plain_text = b"Simple document line 1\nSimple document line 2";
    let fallback_pages = epub_paginator.paginate(plain_text, 2).unwrap();
    assert_eq!(fallback_pages.len(), 2);
    assert_eq!(fallback_pages[0].chapter_title, "Chapter 1");

    // Empty payload fallback
    let empty_pages = epub_paginator.paginate(b"", 1).unwrap();
    assert_eq!(empty_pages.len(), 1);
    assert_eq!(empty_pages[0].paragraphs[0], "Empty document");

    // 2. PDF Paginator
    let pdf_paginator = PdfBookPaginator::new();
    let pdf_text = b"Line 1\nLine 2\nLine 3\nLine 4";
    let pdf_pages = pdf_paginator.paginate(pdf_text, 2).unwrap();
    assert_eq!(pdf_pages.len(), 2);
    assert_eq!(pdf_pages[0].cfi_base, "pdf(page=1)");
    assert_eq!(pdf_pages[1].cfi_base, "pdf(page=2)");

    // 3. Factory
    let from_factory_epub = BookPaginatorFactory::create(BookFormat::Epub);
    assert_eq!(from_factory_epub.paginate(b"test", 1).unwrap().len(), 1);

    let from_factory_pdf = BookPaginatorFactory::create(BookFormat::Pdf);
    assert_eq!(from_factory_pdf.paginate(b"test", 1).unwrap().len(), 1);
}

#[test]
fn test_reader_manager_lifecycle_and_caching() {
    let mut storage = InMemoryStorage::new("reader-storage");
    let mut book_repo = InMemoryBookRepo::default();

    let book_hash = "hash-reader-test-1";
    let raw_content = b"<html><head><title>Reader Test</title></head><body><p>Sample paragraph 1</p><p>Sample paragraph 2</p></body></html>".to_vec();

    storage
        .write_book_binary(book_hash, raw_content.clone(), BookFormat::Epub)
        .unwrap();

    let meta = BookMetadata {
        book_hash: book_hash.to_string(),
        title: "Reader Test".to_string(),
        author: "Tester".to_string(),
        format: BookFormat::Epub,
        current_page: 1,
        total_pages: 5,
        percentage: 20.0,
        cover_image_url: None,
        description: None,
        tags: Vec::new(),
        last_read_at_ms: 1000,
        updated_at_ms: 1000,
    };
    book_repo.save_book(meta).unwrap();

    let mut reader = ReaderManager::new_with_repo(storage, book_repo);

    let _ = reader.storage();
    let _ = reader.storage_mut();
    let _ = reader.book_repo();
    let _ = reader.book_repo_mut();

    // Default constructor with in-memory sqlite
    let default_reader = ReaderManager::new(InMemoryStorage::new("mem"));
    assert_eq!(default_reader.storage().provider_id(), "mem");

    // 1. First retrieval parses and caches
    let pages = reader.get_book_pages(book_hash, 1, 3).unwrap();
    assert_eq!(pages.len(), 3);
    assert_eq!(pages[0].page_number, 1);
    assert_eq!(pages[2].page_number, 3);

    // 2. Second retrieval serves from cache
    let cached_pages = reader.get_book_pages(book_hash, 4, 2).unwrap();
    assert_eq!(cached_pages.len(), 2);
    assert_eq!(cached_pages[0].page_number, 4);

    // 3. Out of range returns empty
    let oob_pages = reader.get_book_pages(book_hash, 10, 5).unwrap();
    assert!(oob_pages.is_empty());

    // 4. Update reading progress
    let updated = reader
        .update_reading_progress(book_hash, 4, 5, 5000)
        .unwrap();
    assert_eq!(updated.current_page, 4);
    assert!((updated.percentage - 80.0).abs() < f64::EPSILON);
    assert_eq!(updated.last_read_at_ms, 5000);

    // 5. Clear cache
    reader.clear_cache(book_hash);

    // 6. Direct filesystem fallback for binary
    let temp_file = env::temp_dir().join(format!("reader_fs_test_{}.pdf", std::process::id()));
    fs::write(&temp_file, b"direct-fs-pdf-payload").unwrap();
    let fs_hash = "hash-fs-pdf";
    reader
        .book_repo_mut()
        .save_book(BookMetadata {
            book_hash: fs_hash.to_string(),
            title: "FS PDF".to_string(),
            author: "Author".to_string(),
            format: BookFormat::Pdf,
            current_page: 1,
            total_pages: 2,
            percentage: 50.0,
            cover_image_url: None,
            description: None,
            tags: Vec::new(),
            last_read_at_ms: 2000,
            updated_at_ms: 2000,
        })
        .unwrap();
    reader
        .book_repo_mut()
        .add_storage_location(BookStorageLocation::new(
            fs_hash,
            "fs-provider",
            temp_file.to_string_lossy().to_string(),
            true,
            Some(2000),
        ))
        .unwrap();

    let fs_bytes = reader.read_book_binary(fs_hash).unwrap();
    assert_eq!(fs_bytes, b"direct-fs-pdf-payload");
    let _ = fs::remove_file(&temp_file);

    // 7. Error handling
    assert!(reader.read_book_binary("nonexistent").is_err());
    assert!(reader.get_book_pages("nonexistent", 1, 1).is_err());
}
