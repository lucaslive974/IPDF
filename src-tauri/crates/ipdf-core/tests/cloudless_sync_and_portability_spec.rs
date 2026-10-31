mod fakes;

use fakes::{InMemoryBookRepo, InMemoryHighlightRepo, InMemoryStorage, JsonExport};
use ipdf_core::core::domain::{BookFormat, BookMetadata, Highlight, HighlightAnchor};
use ipdf_core::core::ports::{
    BookRepository, ExportStrategy, HighlightRepository, StorageProvider, SyncPayload,
};
use ipdf_core::core::services::{
    CloudlessSyncEngine, CreateHighlightInput, DataPortabilityService, HighlightManager,
};

#[test]
fn test_highlight_manager_and_cloudless_sync_lww() {
    let mut book_repo = InMemoryBookRepo::default();
    let mut hl_repo = InMemoryHighlightRepo::default();
    let mut storage = InMemoryStorage::new("local-folder");
    let json_strategy = JsonExport;

    book_repo
        .save(BookMetadata {
            book_hash: "book-phaedo".to_string(),
            title: "Phaedo".to_string(),
            author: "Plato".to_string(),
            format: BookFormat::Epub,
            current_page: 20,
            total_pages: 100,
            percentage: 20.0,
            cover_image_url: None,
            last_read_at_ms: 2000,
            updated_at_ms: 2000,
        })
        .unwrap();

    let mut manager = HighlightManager::new(hl_repo);
    manager
        .create_highlight(CreateHighlightInput {
            id: "hl-local".to_string(),
            book_hash: "book-phaedo".to_string(),
            text: "Immortality of the soul".to_string(),
            color: "#eab308".to_string(),
            anchor: HighlightAnchor {
                format: BookFormat::Epub,
                page_number: 4,
                epub_cfi: Some("epubcfi(/6/2!/4/2:0)".to_string()),
                pdf_rects: None,
            },
            note: "Newer local note".to_string(),
            timestamp_ms: 2000,
        })
        .unwrap();

    assert_eq!(manager.get_for_page(4).len(), 1);
    hl_repo = manager
        .repository_mut()
        .find_by_book("book-phaedo")
        .map(|list| {
            let mut r = InMemoryHighlightRepo::default();
            for item in list {
                r.save(item).unwrap();
            }
            r
        })
        .unwrap();

    let incoming_payload = SyncPayload {
        schema_version: 1,
        exported_at_ms: 3000,
        device_id: "ipad".to_string(),
        books: vec![],
        highlights: vec![
            Highlight::new(
                "hl-local",
                "book-phaedo",
                "Immortality of the soul",
                "#eab308",
                HighlightAnchor {
                    format: BookFormat::Epub,
                    page_number: 4,
                    epub_cfi: Some("epubcfi(/6/2!/4/2:0)".to_string()),
                    pdf_rects: None,
                },
                "Stale remote note",
                1000,
            ),
            Highlight::new(
                "hl-remote-new",
                "book-phaedo",
                "Form of the Good",
                "#22c55e",
                HighlightAnchor {
                    format: BookFormat::Epub,
                    page_number: 8,
                    epub_cfi: Some("epubcfi(/6/4!/4/2:0)".to_string()),
                    pdf_rects: None,
                },
                "Remote note",
                3000,
            ),
        ],
        binaries: None,
    };

    let raw_incoming = json_strategy.serialize(&incoming_payload).unwrap();
    storage
        .write_entry(
            "book-phaedo.highlights.json",
            &raw_incoming,
            "application/json",
        )
        .unwrap();

    let portability = DataPortabilityService::new("desktop");
    let sync_engine = CloudlessSyncEngine::new(portability);
    sync_engine
        .sync_book_state(
            "book-phaedo",
            &mut book_repo,
            &mut hl_repo,
            &mut storage,
            &json_strategy,
            3500,
        )
        .unwrap();

    let kept_local = hl_repo.find_by_id("hl-local").unwrap().unwrap();
    assert_eq!(kept_local.note, "Newer local note");
    assert_eq!(hl_repo.find_by_book("book-phaedo").unwrap().len(), 2);
}
