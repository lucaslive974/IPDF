mod fakes;

use fakes::InMemoryStorage;
use scholarium_core::adapters::pagination::EpubBookPaginator;
use scholarium_core::core::domain::BookFormat;
use scholarium_core::core::ports::{BookPaginator, StorageProvider};
use scholarium_core::core::services::EpubContentService;
use std::io::Write;

#[test]
fn test_epub_paginator() {
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
}

#[test]
fn test_epub_content_service_lifecycle_and_caching() {
    let mut storage = InMemoryStorage::new("epub-storage");
    let book_hash = "hash-epub-test-1";
    let raw_content = b"<html><head><title>Reader Test</title></head><body><p>Sample paragraph 1</p><p>Sample paragraph 2</p></body></html>".to_vec();

    storage
        .write_book_binary(book_hash, raw_content, BookFormat::Epub)
        .unwrap();

    let mut epub_content = EpubContentService::new(storage, EpubBookPaginator::new());
    assert_eq!(epub_content.storage().provider_id(), "epub-storage");
    let _ = epub_content.storage_mut();

    // 1. First retrieval parses and caches
    let pages = epub_content.get_pages(book_hash, 5, 1, 3).unwrap();
    assert_eq!(pages.len(), 3);
    assert_eq!(pages[0].page_number, 1);
    assert_eq!(pages[2].page_number, 3);

    // 2. Second retrieval serves from cache
    let cached_pages = epub_content.get_pages(book_hash, 5, 4, 2).unwrap();
    assert_eq!(cached_pages.len(), 2);
    assert_eq!(cached_pages[0].page_number, 4);

    // 3. Out of range returns empty
    let oob_pages = epub_content.get_pages(book_hash, 5, 10, 5).unwrap();
    assert!(oob_pages.is_empty());

    // 4. Clear cache and verify error on nonexistent
    epub_content.clear_cache(book_hash);
    assert!(epub_content.get_pages("nonexistent", 1, 1, 1).is_err());
}

#[test]
fn test_storage_provider_range_reads() {
    let mut storage = InMemoryStorage::new("mem");
    let payload = b"0123456789ABCDEF-PDF-RANGE".to_vec();
    storage
        .write_book_binary("range-hash", payload.clone(), BookFormat::Pdf)
        .unwrap();

    assert_eq!(
        storage.get_book_size("range-hash").unwrap(),
        payload.len() as u64
    );
    assert_eq!(
        storage.read_book_range("range-hash", 0, 4).unwrap(),
        b"0123"
    );
    assert_eq!(
        storage.read_book_range("range-hash", 10, 6).unwrap(),
        b"ABCDEF"
    );
    assert_eq!(
        storage.read_book_range("range-hash", 21, 100).unwrap(),
        b"RANGE"
    );
    assert!(storage
        .read_book_range("range-hash", 100, 10)
        .unwrap()
        .is_empty());
    assert!(storage.get_book_size("nonexistent").is_err());
    assert!(storage.read_book_range("nonexistent", 0, 10).is_err());
}
