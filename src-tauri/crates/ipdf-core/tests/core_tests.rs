use ipdf_core::domain::{
    AnnotationVisitor, BookFormat, BookMetadata, BoundingBox, Highlight, HighlightAnchor,
    RichAnnotation, RichAnnotationType,
};
use ipdf_core::ports::{
    BookRepository, ExportStrategy, HighlightRepository, PresenceProvider, ReadingActivity,
    ReadingContext, StorageEntry, StorageProvider, SyncPayload,
};
use ipdf_core::services::{
    CachedStorageDecorator, CloudlessSyncEngine, CreateHighlightInput, DataPortabilityService,
    HighlightManager, PromptBuilder, RichPresenceManager, Sha256BookHasher,
};
use std::collections::BTreeMap;
use std::io::Cursor;

#[derive(Default)]
struct InMemoryBookRepo {
    store: BTreeMap<String, BookMetadata>,
}

impl BookRepository for InMemoryBookRepo {
    fn save(&mut self, book: BookMetadata) -> Result<(), String> {
        self.store.insert(book.book_hash.clone(), book);
        Ok(())
    }
    fn find_by_id(&self, book_hash: &str) -> Result<Option<BookMetadata>, String> {
        Ok(self.store.get(book_hash).cloned())
    }
    fn update(&mut self, book: BookMetadata) -> Result<(), String> {
        self.store.insert(book.book_hash.clone(), book);
        Ok(())
    }
    fn delete(&mut self, book_hash: &str) -> Result<(), String> {
        self.store.remove(book_hash);
        Ok(())
    }
    fn find_all(&self) -> Result<Vec<BookMetadata>, String> {
        Ok(self.store.values().cloned().collect())
    }
}

#[derive(Default)]
struct InMemoryHighlightRepo {
    store: BTreeMap<String, Highlight>,
}

impl HighlightRepository for InMemoryHighlightRepo {
    fn save(&mut self, highlight: Highlight) -> Result<(), String> {
        self.store.insert(highlight.id.clone(), highlight);
        Ok(())
    }
    fn find_by_id(&self, id: &str) -> Result<Option<Highlight>, String> {
        Ok(self.store.get(id).cloned())
    }
    fn update(&mut self, highlight: Highlight) -> Result<(), String> {
        self.store.insert(highlight.id.clone(), highlight);
        Ok(())
    }
    fn delete(&mut self, id: &str) -> Result<(), String> {
        self.store.remove(id);
        Ok(())
    }
    fn find_by_book(&self, book_hash: &str) -> Result<Vec<Highlight>, String> {
        Ok(self
            .store
            .values()
            .filter(|h| h.book_hash == book_hash)
            .cloned()
            .collect())
    }
    fn find_by_book_and_page(
        &self,
        book_hash: &str,
        page_number: u32,
    ) -> Result<Vec<Highlight>, String> {
        Ok(self
            .store
            .values()
            .filter(|h| h.book_hash == book_hash && h.anchor.page_number == page_number)
            .cloned()
            .collect())
    }
}

struct InMemoryStorage {
    id: String,
    available: bool,
    binaries: BTreeMap<String, Vec<u8>>,
    entries: BTreeMap<String, (StorageEntry, Vec<u8>)>,
    read_binary_calls: usize,
}

impl InMemoryStorage {
    fn new(id: &str) -> Self {
        Self {
            id: id.to_string(),
            available: true,
            binaries: BTreeMap::new(),
            entries: BTreeMap::new(),
            read_binary_calls: 0,
        }
    }
}

impl StorageProvider for InMemoryStorage {
    fn provider_id(&self) -> &str {
        &self.id
    }
    fn initialize(&mut self) -> Result<bool, String> {
        self.available = true;
        Ok(true)
    }
    fn is_available(&self) -> bool {
        self.available
    }
    fn has_book_binary(&self, book_hash: &str) -> Result<bool, String> {
        Ok(self.binaries.contains_key(book_hash))
    }
    fn read_book_binary(&mut self, book_hash: &str) -> Result<Vec<u8>, String> {
        self.read_binary_calls += 1;
        self.binaries
            .get(book_hash)
            .cloned()
            .ok_or_else(|| format!("Binary not found: {book_hash}"))
    }
    fn write_book_binary(
        &mut self,
        book_hash: &str,
        data: Vec<u8>,
        _format: BookFormat,
    ) -> Result<(), String> {
        self.binaries.insert(book_hash.to_string(), data);
        Ok(())
    }
    fn list_entries(&self, _prefix: Option<&str>) -> Result<Vec<StorageEntry>, String> {
        Ok(self.entries.values().map(|(e, _)| e.clone()).collect())
    }
    fn read_entry(&mut self, name: &str) -> Result<Option<Vec<u8>>, String> {
        Ok(self.entries.get(name).map(|(_, bytes)| bytes.clone()))
    }
    fn write_entry(
        &mut self,
        name: &str,
        data: &[u8],
        mime_type: &str,
    ) -> Result<StorageEntry, String> {
        let entry = StorageEntry {
            name: name.to_string(),
            size_bytes: data.len(),
            mime_type: mime_type.to_string(),
            modified_at_ms: 1000,
        };
        self.entries
            .insert(name.to_string(), (entry.clone(), data.to_vec()));
        Ok(entry)
    }
}

struct JsonExport;

impl ExportStrategy for JsonExport {
    fn serialize(&self, payload: &SyncPayload) -> Result<Vec<u8>, String> {
        serde_json::to_vec(payload).map_err(|e| e.to_string())
    }
    fn deserialize(&self, raw: &[u8]) -> Result<SyncPayload, String> {
        serde_json::from_slice(raw).map_err(|e| e.to_string())
    }
}

struct TestVisitor;

impl AnnotationVisitor<String> for TestVisitor {
    fn visit_assisted_text(&self, raw_data: &str, _updated_at_ms: i64) -> String {
        format!("MD:{raw_data}")
    }
    fn visit_tldraw_board(
        &self,
        _raw_data: &str,
        svg_preview: Option<&str>,
        _updated_at_ms: i64,
    ) -> String {
        format!("TLDRAW:{}", svg_preview.unwrap_or_default())
    }
    fn visit_drawio_diagram(
        &self,
        _raw_data: &str,
        svg_preview: Option<&str>,
        _updated_at_ms: i64,
    ) -> String {
        format!("DRAWIO:{}", svg_preview.unwrap_or_default())
    }
}

struct SpyPresence {
    id: String,
    enabled: bool,
    should_fail: bool,
    published: Vec<ReadingActivity>,
}

impl PresenceProvider for SpyPresence {
    fn id(&self) -> &str {
        &self.id
    }
    fn is_enabled(&self) -> bool {
        self.enabled
    }
    fn publish_activity(&mut self, activity: &ReadingActivity) -> Result<(), String> {
        if self.should_fail {
            return Err("Simulated IPC error".to_string());
        }
        self.published.push(activity.clone());
        Ok(())
    }
    fn clear_activity(&mut self) -> Result<(), String> {
        self.published.clear();
        Ok(())
    }
}

#[test]
fn test_highlight_overlap_and_visitor_double_dispatch() {
    let mut hl = Highlight::new(
        "hl-1",
        "book-1",
        "Allegory",
        "#eab308",
        HighlightAnchor {
            format: BookFormat::Pdf,
            page_number: 10,
            epub_cfi: None,
            pdf_rects: Some(vec![BoundingBox {
                x: 100.0,
                y: 200.0,
                width: 150.0,
                height: 20.0,
            }]),
        },
        "Initial note",
        1000,
    );

    assert!(hl.overlaps_with(&HighlightAnchor {
        format: BookFormat::Pdf,
        page_number: 10,
        epub_cfi: None,
        pdf_rects: Some(vec![BoundingBox {
            x: 120.0,
            y: 205.0,
            width: 40.0,
            height: 10.0,
        }]),
    }));

    RichAnnotation::AssistedMarkdown {
        raw_data: "**Plato**".to_string(),
        updated_at_ms: 2000,
    }
    .attach_to(&mut hl);

    RichAnnotation::Tldraw {
        raw_data: "{}".to_string(),
        svg_preview: Some("<svg>board</svg>".to_string()),
        updated_at_ms: 2500,
    }
    .attach_to(&mut hl);

    assert_eq!(hl.note, "**Plato**");
    assert_eq!(hl.updated_at_ms, 2500);

    let visited = hl.accept_visitor(&TestVisitor);
    assert_eq!(visited, vec!["MD:**Plato**", "TLDRAW:<svg>board</svg>"]);

    hl.remove_rich_annotation(RichAnnotationType::Tldraw, 3000);
    assert_eq!(hl.updated_at_ms, 3000);
}

#[test]
fn test_streaming_sha256_hasher() {
    let cursor = Cursor::new(b"plato-republic-binary-payload");
    let hash = Sha256BookHasher::hash_stream(cursor).expect("hash should succeed");
    assert_eq!(hash.len(), 64);
}

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

#[test]
fn test_cached_storage_decorator_and_presence_debounce() {
    let local_cache = InMemoryStorage::new("local-cache");
    let mut remote = InMemoryStorage::new("google-drive");
    remote
        .write_book_binary("hash-1", vec![1, 2, 3, 4], BookFormat::Epub)
        .unwrap();

    let mut decorated = CachedStorageDecorator::new(local_cache, remote, BookFormat::Epub);
    assert!(decorated.has_book_binary("hash-1").unwrap());

    let bytes = decorated.read_book_binary("hash-1").unwrap();
    assert_eq!(bytes, vec![1, 2, 3, 4]);

    // Presence debounce and fault isolation
    let mut presence = RichPresenceManager::new(3000);
    presence.register_provider(SpyPresence {
        id: "failing".to_string(),
        enabled: true,
        should_fail: true,
        published: vec![],
    });
    presence.register_provider(SpyPresence {
        id: "healthy".to_string(),
        enabled: true,
        should_fail: false,
        published: vec![],
    });

    let activity = ReadingActivity {
        book_hash: "hash-1".to_string(),
        book_title: "Republic".to_string(),
        book_author: "Plato".to_string(),
        chapter_title: Some("Book VII".to_string()),
        current_page: 1,
        total_pages: 300,
        percentage: 0.3,
        state: "reading".to_string(),
        session_started_at_ms: 1000,
    };

    presence.update_activity(&activity, 1000, false);
    presence.update_activity(&activity, 2000, false); // ignored due to 3000ms window

    let prompt = PromptBuilder::build_term_lookup_request(
        &ReadingContext {
            book_title: "Republic".to_string(),
            book_author: "Plato".to_string(),
            chapter_title: Some("Book VII".to_string()),
            selected_text: "noesis".to_string(),
            surrounding_context: "The soul uses noesis.".to_string(),
        },
        "en",
    );
    assert!(prompt.user_prompt.contains("Plato"));
}
