use scholarium_core::adapters::configuration::SqliteConfigurationStore;
use scholarium_core::adapters::persistence::{SqliteBookRepository, SqliteHighlightRepository};
use scholarium_core::adapters::storage::LocalFolderStorageAdapter;
use scholarium_core::core::domain::{BookFormat, BookMetadata, Highlight, HighlightAnchor};
use scholarium_core::core::ports::{
    BookRepository, CloudObjectMeta, CloudStorageError, CloudStorageProvider, HighlightRepository,
    StorageProvider,
};
use scholarium_core::core::services::{CloudSyncEngine, CloudSyncPaths, LocalSyncCursor};
use std::collections::BTreeMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Mutex;

struct InMemoryCloudStorage {
    objects: Mutex<BTreeMap<String, (Vec<u8>, CloudObjectMeta)>>,
    version_counter: AtomicUsize,
    fail_next_if_match: AtomicUsize,
}

impl InMemoryCloudStorage {
    fn new() -> Self {
        Self {
            objects: Mutex::new(BTreeMap::new()),
            version_counter: AtomicUsize::new(1),
            fail_next_if_match: AtomicUsize::new(0),
        }
    }

    fn next_etag(&self) -> String {
        let v = self.version_counter.fetch_add(1, Ordering::SeqCst);
        format!("etag-{v}")
    }

    fn fail_if_match_times(&self, count: usize) {
        self.fail_next_if_match.store(count, Ordering::SeqCst);
    }
}

impl CloudStorageProvider for InMemoryCloudStorage {
    fn provider_id(&self) -> &str {
        "in_memory_cloud"
    }

    fn head(&self, path: &str) -> Result<Option<CloudObjectMeta>, CloudStorageError> {
        let guard = self.objects.lock().unwrap();
        Ok(guard.get(path).map(|(_, meta)| meta.clone()))
    }

    fn read(&self, path: &str) -> Result<Option<(Vec<u8>, CloudObjectMeta)>, CloudStorageError> {
        let guard = self.objects.lock().unwrap();
        Ok(guard.get(path).cloned())
    }

    fn write_unconditional(
        &self,
        path: &str,
        bytes: &[u8],
        _content_type: &str,
    ) -> Result<CloudObjectMeta, CloudStorageError> {
        let meta = CloudObjectMeta {
            path: path.to_string(),
            etag: self.next_etag(),
            size_bytes: bytes.len() as u64,
            modified_at_ms: Some(1_000),
        };
        let mut guard = self.objects.lock().unwrap();
        guard.insert(path.to_string(), (bytes.to_vec(), meta.clone()));
        Ok(meta)
    }

    fn write_if_absent(
        &self,
        path: &str,
        bytes: &[u8],
        content_type: &str,
    ) -> Result<CloudObjectMeta, CloudStorageError> {
        {
            let guard = self.objects.lock().unwrap();
            if guard.contains_key(path) {
                return Err(CloudStorageError::PreconditionFailed(format!(
                    "{path} already exists"
                )));
            }
        }
        self.write_unconditional(path, bytes, content_type)
    }

    fn write_if_match(
        &self,
        path: &str,
        bytes: &[u8],
        content_type: &str,
        expected_etag: &str,
    ) -> Result<CloudObjectMeta, CloudStorageError> {
        let remaining_failures = self.fail_next_if_match.load(Ordering::SeqCst);
        if remaining_failures > 0 {
            self.fail_next_if_match.fetch_sub(1, Ordering::SeqCst);
            return Err(CloudStorageError::PreconditionFailed(
                "simulated concurrent commit".to_string(),
            ));
        }

        {
            let guard = self.objects.lock().unwrap();
            match guard.get(path) {
                Some((_, meta)) if meta.etag == expected_etag => {}
                _ => {
                    return Err(CloudStorageError::PreconditionFailed(format!(
                        "etag mismatch for {path}"
                    )));
                }
            }
        }
        self.write_unconditional(path, bytes, content_type)
    }

    fn delete_if_match(&self, path: &str, expected_etag: &str) -> Result<(), CloudStorageError> {
        let mut guard = self.objects.lock().unwrap();
        match guard.get(path) {
            Some((_, meta)) if meta.etag == expected_etag => {
                guard.remove(path);
                Ok(())
            }
            _ => Err(CloudStorageError::PreconditionFailed(format!(
                "etag mismatch deleting {path}"
            ))),
        }
    }

    fn delete_unconditional(&self, path: &str) -> Result<(), CloudStorageError> {
        let mut guard = self.objects.lock().unwrap();
        guard.remove(path);
        Ok(())
    }

    fn list_prefix(&self, prefix: &str) -> Result<Vec<CloudObjectMeta>, CloudStorageError> {
        let guard = self.objects.lock().unwrap();
        Ok(guard
            .iter()
            .filter(|(k, _)| k.starts_with(prefix))
            .map(|(_, (_, meta))| meta.clone())
            .collect())
    }
}

struct DeviceEnv {
    book_repo: SqliteBookRepository,
    highlight_repo: SqliteHighlightRepository,
    storage: LocalFolderStorageAdapter,
    config: SqliteConfigurationStore,
    root_dir: PathBuf,
}

impl DeviceEnv {
    fn new(name: &str) -> Self {
        let unique = format!(
            "scholarium_sync_test_{}_{}_{}",
            name,
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        );
        let root_dir = std::env::temp_dir().join(unique);
        let mut storage = LocalFolderStorageAdapter::new("local", &root_dir);
        storage.initialize().unwrap();
        Self {
            book_repo: SqliteBookRepository::new_in_memory().unwrap(),
            highlight_repo: SqliteHighlightRepository::new_in_memory().unwrap(),
            storage,
            config: SqliteConfigurationStore::new_in_memory().unwrap(),
            root_dir,
        }
    }
}

impl Drop for DeviceEnv {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.root_dir);
    }
}

fn make_book(hash: &str, title: &str, current_page: u32, updated_at_ms: i64) -> BookMetadata {
    BookMetadata {
        book_hash: hash.to_string(),
        title: title.to_string(),
        author: "Plato".to_string(),
        format: BookFormat::Epub,
        current_page,
        total_pages: 100,
        percentage: current_page as f64,
        description: Some("Classical dialogue".to_string()),
        tags: vec!["philosophy".to_string()],
        page_offset_ratio: 0.0,
        last_read_at_ms: updated_at_ms,
        updated_at_ms,
    }
}

fn make_highlight(id: &str, book_hash: &str, note: &str, updated_at_ms: i64) -> Highlight {
    Highlight::new(
        id,
        book_hash,
        "Excerpt",
        "#FDE047",
        HighlightAnchor {
            format: BookFormat::Epub,
            page_number: 10,
            epub_cfi: Some("epubcfi(/6/2!/4/2)".to_string()),
            pdf_rects: None,
        },
        note,
        updated_at_ms,
    )
}

#[test]
fn syncs_metadata_highlights_and_covers_without_auto_downloading_book_binary() {
    let cloud = InMemoryCloudStorage::new();
    let engine = CloudSyncEngine::new();
    let mut pc = DeviceEnv::new("pc_initial");
    let mut mobile = DeviceEnv::new("mobile_initial");

    // PC imports a book + cover + highlight.
    let hash = "book-sha256-001";
    pc.book_repo
        .save_book(make_book(hash, "Republic", 15, 1_000))
        .unwrap();
    pc.storage
        .write_book_binary(hash, b"EPUB-HEAVY-PAYLOAD".to_vec(), BookFormat::Epub)
        .unwrap();
    pc.storage
        .write_book_cover(hash, b"JPEG-COVER", "image/jpeg")
        .unwrap();
    pc.highlight_repo
        .save(make_highlight("h1", hash, "Cave allegory", 1_000))
        .unwrap();

    let pc_report = engine
        .sync_once(
            &mut pc.book_repo,
            &mut pc.highlight_repo,
            &mut pc.storage,
            &mut pc.config,
            &cloud,
            1_000,
        )
        .unwrap();
    assert_eq!(pc_report.revision, 1);
    assert_eq!(pc_report.uploaded_blobs, 1);
    assert_eq!(pc_report.pushed_books, 1);
    assert!(cloud
        .head(&CloudSyncPaths::book_blob(hash, BookFormat::Epub))
        .unwrap()
        .is_some());

    // Mobile detects remote change via cheap HEAD check.
    assert!(engine.check_remote_changed(&mobile.config, &cloud).unwrap());

    // Mobile syncs: pulls metadata, highlight, and cover, but NOT the heavy book binary.
    let mobile_report = engine
        .sync_once(
            &mut mobile.book_repo,
            &mut mobile.highlight_repo,
            &mut mobile.storage,
            &mut mobile.config,
            &cloud,
            1_100,
        )
        .unwrap();
    assert_eq!(mobile_report.revision, 1);
    assert_eq!(mobile_report.pulled_books, 1);
    assert_eq!(mobile_report.downloaded_covers, 1);
    assert_eq!(mobile_report.pushed_books, 0);

    let synced_book = mobile.book_repo.find_book_by_hash(hash).unwrap().unwrap();
    assert_eq!(synced_book.title, "Republic");
    assert_eq!(synced_book.current_page, 15);
    assert_eq!(mobile.highlight_repo.find_by_book(hash).unwrap().len(), 1);
    assert!(mobile.storage.read_book_cover(hash).unwrap().is_some());
    assert!(!mobile.storage.has_book_binary(hash).unwrap());

    // Subsequent cheap HEAD check reports no changes.
    assert!(!engine.check_remote_changed(&mobile.config, &cloud).unwrap());
}

#[test]
fn merges_concurrent_offline_edits_with_lww_and_retries_on_etag_conflict() {
    let cloud = InMemoryCloudStorage::new();
    let engine = CloudSyncEngine::new();
    let mut pc = DeviceEnv::new("pc_lww");
    let mut mobile = DeviceEnv::new("mobile_lww");

    let hash = "book-sha256-002";
    pc.book_repo
        .save_book(make_book(hash, "Symposium", 10, 1_000))
        .unwrap();
    pc.highlight_repo
        .save(make_highlight("h_shared", hash, "Initial note", 1_000))
        .unwrap();

    engine
        .sync_once(
            &mut pc.book_repo,
            &mut pc.highlight_repo,
            &mut pc.storage,
            &mut pc.config,
            &cloud,
            1_000,
        )
        .unwrap();
    engine
        .sync_once(
            &mut mobile.book_repo,
            &mut mobile.highlight_repo,
            &mut mobile.storage,
            &mut mobile.config,
            &cloud,
            1_100,
        )
        .unwrap();

    // Offline divergence: PC advances page and adds h_pc; Mobile edits h_shared (newer) and adds h_mobile.
    pc.book_repo
        .save_book(make_book(hash, "Symposium", 42, 2_000))
        .unwrap();
    pc.highlight_repo
        .save(make_highlight("h_pc", hash, "PC note", 2_000))
        .unwrap();

    mobile
        .highlight_repo
        .update(make_highlight("h_shared", hash, "Updated on mobile", 3_000))
        .unwrap();
    mobile
        .highlight_repo
        .save(make_highlight("h_mobile", hash, "Mobile note", 3_000))
        .unwrap();

    // PC syncs first.
    let pc_rep = engine
        .sync_once(
            &mut pc.book_repo,
            &mut pc.highlight_repo,
            &mut pc.storage,
            &mut pc.config,
            &cloud,
            2_500,
        )
        .unwrap();
    assert_eq!(pc_rep.revision, 2);

    // Inject a 412 PreconditionFailed on Mobile's first commit attempt to test retry loop.
    cloud.fail_if_match_times(1);
    let mobile_rep = engine
        .sync_once(
            &mut mobile.book_repo,
            &mut mobile.highlight_repo,
            &mut mobile.storage,
            &mut mobile.config,
            &cloud,
            3_500,
        )
        .unwrap();
    assert_eq!(mobile_rep.retries, 1);
    assert_eq!(mobile_rep.revision, 3);

    // Mobile now has all 3 highlights and PC's page 42.
    let mobile_book = mobile.book_repo.find_book_by_hash(hash).unwrap().unwrap();
    assert_eq!(mobile_book.current_page, 42);
    let mobile_highlights = mobile.highlight_repo.find_by_book(hash).unwrap();
    assert_eq!(mobile_highlights.len(), 3);
    let shared = mobile
        .highlight_repo
        .find_by_id("h_shared")
        .unwrap()
        .unwrap();
    assert_eq!(shared.note, "Updated on mobile");

    // PC pulls the merged state.
    engine
        .sync_once(
            &mut pc.book_repo,
            &mut pc.highlight_repo,
            &mut pc.storage,
            &mut pc.config,
            &cloud,
            4_000,
        )
        .unwrap();
    assert_eq!(pc.highlight_repo.find_by_book(hash).unwrap().len(), 3);
    assert_eq!(
        pc.highlight_repo
            .find_by_id("h_shared")
            .unwrap()
            .unwrap()
            .note,
        "Updated on mobile"
    );
}

#[test]
fn propagates_highlight_and_book_deletions_via_tombstones() {
    let cloud = InMemoryCloudStorage::new();
    let engine = CloudSyncEngine::new();
    let mut pc = DeviceEnv::new("pc_del");
    let mut mobile = DeviceEnv::new("mobile_del");

    let hash = "book-sha256-003";
    pc.book_repo
        .save_book(make_book(hash, "Phaedo", 5, 1_000))
        .unwrap();
    pc.highlight_repo
        .save(make_highlight("h1", hash, "To be deleted", 1_000))
        .unwrap();

    engine
        .sync_once(
            &mut pc.book_repo,
            &mut pc.highlight_repo,
            &mut pc.storage,
            &mut pc.config,
            &cloud,
            1_000,
        )
        .unwrap();
    engine
        .sync_once(
            &mut mobile.book_repo,
            &mut mobile.highlight_repo,
            &mut mobile.storage,
            &mut mobile.config,
            &cloud,
            1_100,
        )
        .unwrap();

    // PC deletes highlight h1 and records its tombstone.
    pc.highlight_repo.delete("h1").unwrap();
    let mut pc_cursor = LocalSyncCursor::load(&pc.config).unwrap();
    pc_cursor.record_deleted_highlight(hash, "h1", 2_000);
    pc_cursor.save(&mut pc.config).unwrap();

    engine
        .sync_once(
            &mut pc.book_repo,
            &mut pc.highlight_repo,
            &mut pc.storage,
            &mut pc.config,
            &cloud,
            2_000,
        )
        .unwrap();
    engine
        .sync_once(
            &mut mobile.book_repo,
            &mut mobile.highlight_repo,
            &mut mobile.storage,
            &mut mobile.config,
            &cloud,
            2_100,
        )
        .unwrap();
    assert!(mobile.highlight_repo.find_by_id("h1").unwrap().is_none());

    // Now PC deletes the entire book.
    pc.book_repo.delete_book(hash).unwrap();
    engine
        .sync_once(
            &mut pc.book_repo,
            &mut pc.highlight_repo,
            &mut pc.storage,
            &mut pc.config,
            &cloud,
            3_000,
        )
        .unwrap();

    let mobile_rep = engine
        .sync_once(
            &mut mobile.book_repo,
            &mut mobile.highlight_repo,
            &mut mobile.storage,
            &mut mobile.config,
            &cloud,
            3_100,
        )
        .unwrap();
    assert_eq!(mobile_rep.deleted_books, 1);
    assert!(mobile.book_repo.find_book_by_hash(hash).unwrap().is_none());
}

#[test]
fn exercises_retry_exhaustion_and_direct_lww_merge_edge_cases() {
    use scholarium_core::core::domain::{
        BookSyncMetadata, BookSyncProgress, BookSyncState, HighlightSyncEntry,
    };
    use scholarium_core::core::services::merge_book_states;

    let _default_engine = CloudSyncEngine::default();
    let limited_engine = CloudSyncEngine::with_max_retries(1);
    let cloud = InMemoryCloudStorage::new();
    let mut pc = DeviceEnv::new("pc_exhaust");
    let hash = "book-sha256-004";
    pc.book_repo
        .save_book(make_book(hash, "Gorgias", 1, 1_000))
        .unwrap();

    // First sync succeeds (creates manifest).
    limited_engine
        .sync_once(
            &mut pc.book_repo,
            &mut pc.highlight_repo,
            &mut pc.storage,
            &mut pc.config,
            &cloud,
            1_000,
        )
        .unwrap();

    // Update book locally and force more 412 conflicts than max_retries -> returns error.
    pc.book_repo
        .save_book(make_book(hash, "Gorgias", 2, 2_000))
        .unwrap();
    cloud.fail_if_match_times(5);
    let err = limited_engine
        .sync_once(
            &mut pc.book_repo,
            &mut pc.highlight_repo,
            &mut pc.storage,
            &mut pc.config,
            &cloud,
            2_000,
        )
        .unwrap_err();
    assert!(err.contains("precondition failed"));

    // Direct LWW merge edge cases: remote metadata/progress newer + equal-timestamp tombstone wins.
    let mut local_h = BTreeMap::new();
    local_h.insert(
        "h1".to_string(),
        HighlightSyncEntry::active(make_highlight("h1", hash, "local", 500)),
    );
    let mut remote_h = BTreeMap::new();
    remote_h.insert("h1".to_string(), HighlightSyncEntry::tombstone("h1", 500));

    let local_state = BookSyncState {
        book_hash: hash.to_string(),
        metadata: BookSyncMetadata {
            title: "Old".to_string(),
            author: "Plato".to_string(),
            format: BookFormat::Pdf,
            total_pages: 10,
            description: None,
            tags: vec![],
            updated_at_ms: 100,
        },
        progress: BookSyncProgress {
            current_page: 1,
            percentage: 10.0,
            page_offset_ratio: 0.0,
            last_read_at_ms: 100,
            updated_at_ms: 100,
        },
        highlights: local_h,
    };
    let remote_state = BookSyncState {
        book_hash: hash.to_string(),
        metadata: BookSyncMetadata {
            title: "New".to_string(),
            author: "Plato".to_string(),
            format: BookFormat::Pdf,
            total_pages: 10,
            description: None,
            tags: vec![],
            updated_at_ms: 200,
        },
        progress: BookSyncProgress {
            current_page: 9,
            percentage: 90.0,
            page_offset_ratio: 0.5,
            last_read_at_ms: 200,
            updated_at_ms: 200,
        },
        highlights: remote_h,
    };

    let merged = merge_book_states(&local_state, &remote_state);
    assert_eq!(merged.metadata.title, "New");
    assert_eq!(merged.progress.current_page, 9);
    assert!(merged.highlights["h1"].is_deleted());
}
