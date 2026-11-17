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
