use scholarium_core::adapters::backup::LocalBackupDestination;
use scholarium_core::adapters::platform::{AndroidEnvironment, IosEnvironment, LinuxEnvironment};
use scholarium_core::adapters::storage::LocalFolderStorageAdapter;
use scholarium_core::core::domain::BookFormat;
use scholarium_core::core::ports::{
    parse_backup_filename, sanitize_device_label, BackupDestination, PlatformEnvironment,
    StorageProvider,
};
use scholarium_core::core::services::BackupService;
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
fn test_backup_service_creates_lists_and_restores_local_zip_snapshot() {
    let root = make_temp_root("backup_service");
    let env = LinuxEnvironment::new(Some(root.clone()));

    let mut storage = LocalFolderStorageAdapter::for_platform("local", &env).expect("storage");
    storage.initialize().expect("init storage");
    storage
        .write_book_binary("hash-abc", b"epub-payload".to_vec(), BookFormat::Epub)
        .expect("write book");
    storage
        .write_book_cover("hash-abc", b"webp-cover", "image/webp")
        .expect("write cover");

    let db_path = env.resolve_database_path("scholarium.db").expect("db path");
    fs::create_dir_all(db_path.parent().unwrap()).expect("create config dir");
    fs::write(&db_path, b"sqlite-mock-bytes").expect("write mock db");

    let backup_dir = root.join("backups");
    let destination = LocalBackupDestination::new(backup_dir.clone());
    let service = BackupService::new();

    let (artifact, create_report) = service
        .create_backup(&env, &destination, 1_700_000_000_000)
        .expect("create backup");

    assert_eq!(create_report.books_count, 1);
    assert_eq!(create_report.covers_count, 1);
    assert!(create_report.includes_database);
    assert!(artifact.size_bytes > 0);
    assert!(artifact.name.starts_with("scholarium-backup-"));
    assert!(artifact.name.ends_with("-linux-1700000000000.zip"));
    assert_eq!(artifact.platform, "linux");
    assert!(!artifact.device_label.is_empty());
    assert_eq!(artifact.created_at_ms, 1_700_000_000_000);

    let parsed = parse_backup_filename(&artifact.name).expect("parse backup filename");
    assert_eq!(parsed.0, artifact.device_label);
    assert_eq!(parsed.1, "linux");
    assert_eq!(parsed.2, 1_700_000_000_000);

    let listed = destination.list_backups().expect("list backups");
    assert_eq!(listed.len(), 1);
    assert_eq!(listed[0].id, artifact.id);

    // Wipe local data
    storage.clear().expect("clear storage");
    fs::remove_file(&db_path).expect("remove db");
    assert!(!storage.has_book_binary("hash-abc").unwrap());
    assert!(!db_path.exists());

    // Restore from backup
    let restore_report = service
        .restore_backup(&env, &destination, &artifact.id)
        .expect("restore backup");

    assert_eq!(restore_report.books_count, 1);
    assert_eq!(restore_report.covers_count, 1);
    assert!(restore_report.includes_database);
    assert!(storage.has_book_binary("hash-abc").unwrap());
    assert_eq!(
        storage.read_book_binary("hash-abc").unwrap(),
        b"epub-payload"
    );
    assert!(storage.read_book_cover("hash-abc").unwrap().is_some());
    assert_eq!(fs::read(&db_path).unwrap(), b"sqlite-mock-bytes");

    assert!(destination.delete_backup(&artifact.id).expect("delete"));
    assert!(destination.list_backups().unwrap().is_empty());

    let _ = fs::remove_dir_all(&root);
}

#[test]
fn test_device_label_sanitization_and_mobile_fallbacks() {
    assert_eq!(
        sanitize_device_label("Lucas-Notebook Pro!", "desktop"),
        "lucas_notebook_pro"
    );
    assert_eq!(sanitize_device_label("   ---   ", "desktop"), "desktop");

    let android = AndroidEnvironment::default();
    assert_eq!(android.device_label(), "android_device");

    let ios = IosEnvironment::default();
    assert_eq!(ios.device_label(), "ios_device");
}

#[test]
fn test_cloud_and_hybrid_backup_destination_lifecycle() {
    use scholarium_core::adapters::backup::{CloudBackupDestination, HybridBackupDestination};
    use scholarium_core::core::ports::{
        BackupLocation, CloudObjectMeta, CloudStorageError, CloudStorageProvider,
    };
    use std::collections::BTreeMap;
    use std::sync::{Arc, Mutex};

    struct InMemoryCloud(Mutex<BTreeMap<String, Vec<u8>>>);
    impl InMemoryCloud {
        fn meta(path: &str, len: usize) -> CloudObjectMeta {
            CloudObjectMeta {
                path: path.to_string(),
                size_bytes: len as u64,
                etag: "etag-1".to_string(),
                modified_at_ms: Some(1_000),
            }
        }
    }
    impl CloudStorageProvider for InMemoryCloud {
        fn provider_id(&self) -> &'static str {
            "fake_cloud"
        }
        fn head(&self, path: &str) -> Result<Option<CloudObjectMeta>, CloudStorageError> {
            let map = self.0.lock().unwrap();
            Ok(map.get(path).map(|b| Self::meta(path, b.len())))
        }
        fn read(
            &self,
            path: &str,
        ) -> Result<Option<(Vec<u8>, CloudObjectMeta)>, CloudStorageError> {
            let map = self.0.lock().unwrap();
            Ok(map
                .get(path)
                .map(|b| (b.clone(), Self::meta(path, b.len()))))
        }
        fn write_unconditional(
            &self,
            path: &str,
            bytes: &[u8],
            _content_type: &str,
        ) -> Result<CloudObjectMeta, CloudStorageError> {
            self.0
                .lock()
                .unwrap()
                .insert(path.to_string(), bytes.to_vec());
            Ok(Self::meta(path, bytes.len()))
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
        fn delete_if_match(&self, path: &str, _etag: &str) -> Result<(), CloudStorageError> {
            self.delete_unconditional(path)
        }
        fn delete_unconditional(&self, path: &str) -> Result<(), CloudStorageError> {
            self.0.lock().unwrap().remove(path);
            Ok(())
        }
        fn list_prefix(&self, prefix: &str) -> Result<Vec<CloudObjectMeta>, CloudStorageError> {
            let map = self.0.lock().unwrap();
            Ok(map
                .iter()
                .filter(|(k, _)| k.starts_with(prefix))
                .map(|(k, v)| Self::meta(k, v.len()))
                .collect())
        }
    }

    let root = std::env::temp_dir().join("scholarium_hybrid_backup_spec");
    let _ = fs::remove_dir_all(&root);
    let local = LocalBackupDestination::new(root.join("backups"));
    let cloud = Arc::new(InMemoryCloud(Mutex::new(BTreeMap::new())));
    let remote = Arc::new(CloudBackupDestination::new(cloud));
    let hybrid = HybridBackupDestination::new(local, Some(remote.clone()));

    let local_name = "scholarium-backup-pc-linux-1000.zip";
    let remote_only_name = "scholarium-backup-phone-android-2000.zip";
    hybrid.save_backup(local_name, b"local-zip").unwrap();
    remote.save_backup(remote_only_name, b"remote-zip").unwrap();

    // List merges local + remote
    let list = hybrid.list_backups().unwrap();
    assert_eq!(list.len(), 2);
    assert_eq!(list[0].id, remote_only_name);
    assert_eq!(list[0].location, BackupLocation::Remote);
    assert_eq!(list[1].id, local_name);
    assert_eq!(list[1].location, BackupLocation::Local);

    // Explicit upload marks as Both
    assert!(hybrid.remote().is_some());
    assert!(hybrid.local().backup_dir().ends_with("backups"));
    let uploaded = hybrid.upload_local_to_remote(local_name).unwrap();
    assert_eq!(uploaded.location, BackupLocation::Both);
    let list_after_upload = hybrid.list_backups().unwrap();
    assert_eq!(list_after_upload[1].location, BackupLocation::Both);

    // Load remote-only backup transparently + missing error
    assert_eq!(hybrid.load_backup(remote_only_name).unwrap(), b"remote-zip");
    assert!(hybrid.load_backup("missing.zip").is_err());

    // Delete local and remote explicitly
    assert!(hybrid.delete_backup(local_name).unwrap());
    assert!(hybrid.delete_remote(remote_only_name).unwrap());
    assert!(hybrid.delete_remote(local_name).unwrap());
    assert!(hybrid.list_backups().unwrap().is_empty());

    let _ = fs::remove_dir_all(&root);
}
