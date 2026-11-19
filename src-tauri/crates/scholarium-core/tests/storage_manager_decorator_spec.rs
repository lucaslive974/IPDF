use scholarium_core::adapters::storage::{LocalFolderStorageAdapter, StorageManagerDecorator};
use scholarium_core::core::domain::{BookAvailability, BookFormat};
use scholarium_core::core::ports::{
    CloudObjectMeta, CloudStorageError, CloudStorageProvider, StorageProvider,
};
use scholarium_core::core::services::CloudSyncPaths;
use std::collections::BTreeMap;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};

struct CountingCloudStorage {
    objects: Mutex<BTreeMap<String, Vec<u8>>>,
    read_calls: AtomicUsize,
}

impl CountingCloudStorage {
    fn new() -> Self {
        Self {
            objects: Mutex::new(BTreeMap::new()),
            read_calls: AtomicUsize::new(0),
        }
    }

    fn put(&self, path: &str, bytes: &[u8]) {
        self.objects
            .lock()
            .unwrap()
            .insert(path.to_string(), bytes.to_vec());
    }

    fn read_count(&self) -> usize {
        self.read_calls.load(Ordering::SeqCst)
    }
}

impl CloudStorageProvider for CountingCloudStorage {
    fn provider_id(&self) -> &str {
        "counting_cloud"
    }

    fn head(&self, path: &str) -> Result<Option<CloudObjectMeta>, CloudStorageError> {
        let guard = self.objects.lock().unwrap();
        Ok(guard.get(path).map(|b| CloudObjectMeta {
            path: path.to_string(),
            etag: "e1".to_string(),
            size_bytes: b.len() as u64,
            modified_at_ms: None,
        }))
    }

    fn read(&self, path: &str) -> Result<Option<(Vec<u8>, CloudObjectMeta)>, CloudStorageError> {
        self.read_calls.fetch_add(1, Ordering::SeqCst);
        let guard = self.objects.lock().unwrap();
        Ok(guard.get(path).map(|b| {
            (
                b.clone(),
                CloudObjectMeta {
                    path: path.to_string(),
                    etag: "e1".to_string(),
                    size_bytes: b.len() as u64,
                    modified_at_ms: None,
                },
            )
        }))
    }

    fn write_unconditional(
        &self,
        path: &str,
        bytes: &[u8],
        _content_type: &str,
    ) -> Result<CloudObjectMeta, CloudStorageError> {
        self.put(path, bytes);
        Ok(CloudObjectMeta {
            path: path.to_string(),
            etag: "e1".to_string(),
            size_bytes: bytes.len() as u64,
            modified_at_ms: None,
        })
    }

    fn write_if_absent(
        &self,
        path: &str,
        bytes: &[u8],
        content_type: &str,
    ) -> Result<CloudObjectMeta, CloudStorageError> {
        self.write_unconditional(path, bytes, content_type)
    }

    fn write_if_match(
        &self,
        path: &str,
        bytes: &[u8],
        content_type: &str,
        _expected_etag: &str,
    ) -> Result<CloudObjectMeta, CloudStorageError> {
        self.write_unconditional(path, bytes, content_type)
    }

    fn delete_if_match(&self, path: &str, _expected_etag: &str) -> Result<(), CloudStorageError> {
        self.delete_unconditional(path)
    }

    fn delete_unconditional(&self, path: &str) -> Result<(), CloudStorageError> {
        self.objects.lock().unwrap().remove(path);
        Ok(())
    }

    fn list_prefix(&self, _prefix: &str) -> Result<Vec<CloudObjectMeta>, CloudStorageError> {
        Ok(vec![])
    }
}

fn temp_dir(name: &str) -> std::path::PathBuf {
    std::env::temp_dir().join(format!(
        "scholarium_storage_mgr_{}_{}_{}",
        name,
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ))
}

#[test]
fn local_only_mode_delegates_directly_without_cloud() {
    let dir = temp_dir("local_only");
    let local = LocalFolderStorageAdapter::new("local", &dir);
    let mut manager = StorageManagerDecorator::new_local_only(local);
    manager.initialize().unwrap();
    assert!(manager.is_available());
    assert_eq!(manager.provider_id(), "local");
    assert!(!manager.has_remote());

    let hash = "local-book-1";
    assert_eq!(
        manager.book_availability(hash).unwrap(),
        BookAvailability::RemoteOnly
    );
    assert!(manager
        .ensure_book_downloaded(hash, BookFormat::Epub)
        .is_err());

    manager
        .write_book_binary(hash, b"EPUB-BYTES".to_vec(), BookFormat::Epub)
        .unwrap();
    assert_eq!(
        manager.book_availability(hash).unwrap(),
        BookAvailability::Local
    );
    assert_eq!(manager.read_book_binary(hash).unwrap(), b"EPUB-BYTES");
    assert_eq!(manager.get_book_size(hash).unwrap(), 10);
    assert_eq!(manager.read_book_range(hash, 0, 4).unwrap(), b"EPUB");

    manager
        .write_entry("note.txt", b"hello", "text/plain")
        .unwrap();
    assert_eq!(
        manager.read_entry("note.txt").unwrap(),
        Some(b"hello".to_vec())
    );
    assert!(!manager.list_entries(None).unwrap().is_empty());
    assert!(manager.resolve_entry_path("note.txt").is_some());
    manager.rename_entry("note.txt", "note2.txt").unwrap();
    assert!(manager.delete_entry("note2.txt").unwrap());
    assert!(manager.local().is_available());
    assert!(manager.local_mut().is_available());
    manager.clear().unwrap();

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn downloads_remote_books_on_demand_caches_locally_and_supports_eviction() {
    let dir = temp_dir("hybrid");
    let local = LocalFolderStorageAdapter::new("local", &dir);
    let cloud = Arc::new(CountingCloudStorage::new());
    let mut manager = StorageManagerDecorator::new(local, None);
    manager.initialize().unwrap();

    // Attach remote cloud provider at runtime.
    manager.set_remote(Some(cloud.clone()));
    assert!(manager.has_remote());

    let hash = "remote-pdf-1";
    let pdf_payload = b"%PDF-1.7-SAMPLE-CONTENT";
    cloud.put(
        &CloudSyncPaths::book_blob(hash, BookFormat::Pdf),
        pdf_payload,
    );
    manager
        .write_book_cover(hash, b"COVER-IMG", "image/jpeg")
        .unwrap();

    assert_eq!(
        manager.book_availability(hash).unwrap(),
        BookAvailability::RemoteOnly
    );

    // Reading transparently fetches from cloud and caches locally.
    let loaded = manager.read_book_binary(hash).unwrap();
    assert_eq!(loaded, pdf_payload);
    assert_eq!(
        manager.book_availability(hash).unwrap(),
        BookAvailability::Local
    );
    let reads_after_first = cloud.read_count();
    assert!(reads_after_first >= 1);

    // Second read hits local disk with zero additional cloud reads.
    assert_eq!(manager.read_book_binary(hash).unwrap(), pdf_payload);
    assert_eq!(cloud.read_count(), reads_after_first);
    assert!(!manager
        .ensure_book_downloaded(hash, BookFormat::Pdf)
        .unwrap());

    // Evicting removes only local binary while keeping cover intact.
    assert!(manager.evict_local_book(hash).unwrap());
    assert_eq!(
        manager.book_availability(hash).unwrap(),
        BookAvailability::RemoteOnly
    );
    assert!(manager.read_book_cover(hash).unwrap().is_some());

    // Explicit ensure_book_downloaded re-fetches from cloud.
    assert!(manager
        .ensure_book_downloaded(hash, BookFormat::Pdf)
        .unwrap());
    assert_eq!(
        manager.book_availability(hash).unwrap(),
        BookAvailability::Local
    );

    // Missing remote blob returns an explicit error.
    assert!(manager
        .ensure_book_downloaded("does-not-exist", BookFormat::Epub)
        .is_err());

    let _ = std::fs::remove_dir_all(&dir);
}
