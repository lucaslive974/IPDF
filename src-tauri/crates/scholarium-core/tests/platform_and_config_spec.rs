use scholarium_core::adapters::configuration::SqliteConfigurationStore;
use scholarium_core::adapters::persistence::SqliteHighlightRepository;
use scholarium_core::adapters::platform::{
    create_platform_environment, AndroidEnvironment, IosEnvironment, LinuxEnvironment,
    WindowsEnvironment,
};
use scholarium_core::adapters::storage::LocalFolderStorageAdapter;
use scholarium_core::core::domain::{BookFormat, Highlight, HighlightAnchor, PlatformKind};
use scholarium_core::core::ports::{
    ConfigurationStore, HighlightRepository, PlatformEnvironment, StorageProvider,
};
use scholarium_core::core::services::LibraryManager;
use std::env;
use std::fs;

#[test]
fn test_platform_environments_path_resolution() {
    let temp_base = env::temp_dir().join(format!("scholarium_env_test_{}", std::process::id()));
    let _ = fs::remove_dir_all(&temp_base);

    // 1. Linux with Flatpak .var path
    let linux = LinuxEnvironment::new(Some(temp_base.join(".var/app/com.scholarium.reader")));
    assert_eq!(linux.platform_kind(), PlatformKind::Linux);
    let linux_data = linux.data_dir().unwrap();
    let linux_cfg = linux.config_dir().unwrap();
    let linux_cache = linux.cache_dir().unwrap();
    assert!(linux_data
        .to_string_lossy()
        .contains(".var/app/com.scholarium.reader/data"));
    assert!(linux_cfg
        .to_string_lossy()
        .contains(".var/app/com.scholarium.reader/config"));
    assert!(linux_cache
        .to_string_lossy()
        .contains(".var/app/com.scholarium.reader/cache"));
    assert!(linux
        .resolve_database_path("scholarium.db")
        .unwrap()
        .ends_with("scholarium.db"));
    assert!(linux
        .resolve_highlights_path("sha256-book1")
        .unwrap()
        .to_string_lossy()
        .ends_with("sha256-book1.highlights.json"));

    let linux_default = LinuxEnvironment::default();
    assert_eq!(linux_default.platform_kind(), PlatformKind::Linux);
    assert!(linux_default.data_dir().is_ok());

    // 2. Android (.var / files dir)
    let android = AndroidEnvironment::new(Some(temp_base.join(".var/android/data")));
    assert_eq!(android.platform_kind(), PlatformKind::Android);
    assert!(android
        .data_dir()
        .unwrap()
        .to_string_lossy()
        .contains(".var/android/data/files"));
    assert!(android
        .config_dir()
        .unwrap()
        .to_string_lossy()
        .contains(".var/android/data/shared_prefs"));
    assert!(android
        .cache_dir()
        .unwrap()
        .to_string_lossy()
        .contains(".var/android/data/cache"));

    let android_default = AndroidEnvironment::default();
    assert_eq!(android_default.platform_kind(), PlatformKind::Android);
    assert!(android_default.config_dir().is_ok());

    // 3. Windows (AppData / LocalAppData)
    let windows = WindowsEnvironment::new(Some(temp_base.join("Users/Test/AppData")));
    assert_eq!(windows.platform_kind(), PlatformKind::Windows);
    assert!(windows
        .config_dir()
        .unwrap()
        .to_string_lossy()
        .contains("Roaming/Scholarium"));
    assert!(windows
        .data_dir()
        .unwrap()
        .to_string_lossy()
        .contains("Local/Scholarium/Data"));
    assert!(windows
        .cache_dir()
        .unwrap()
        .to_string_lossy()
        .contains("Local/Scholarium/Cache"));

    let windows_default = WindowsEnvironment::default();
    assert_eq!(windows_default.platform_kind(), PlatformKind::Windows);
    assert!(windows_default.cache_dir().is_ok());

    // 4. iOS (iPhone storage Documents / Application Support)
    let ios = IosEnvironment::new(Some(
        temp_base.join("var/mobile/Containers/Data/Application"),
    ));
    assert_eq!(ios.platform_kind(), PlatformKind::Ios);
    assert!(ios
        .data_dir()
        .unwrap()
        .to_string_lossy()
        .contains("Documents"));
    assert!(ios
        .config_dir()
        .unwrap()
        .to_string_lossy()
        .contains("Library/Application Support/Scholarium"));
    assert!(ios
        .cache_dir()
        .unwrap()
        .to_string_lossy()
        .contains("Library/Caches/Scholarium"));

    let ios_default = IosEnvironment::default();
    assert_eq!(ios_default.platform_kind(), PlatformKind::Ios);
    assert!(ios_default.data_dir().is_ok());

    // Factory with supported PlatformKinds
    for kind in [
        PlatformKind::Linux,
        PlatformKind::Android,
        PlatformKind::Windows,
        PlatformKind::Ios,
    ] {
        let boxed = create_platform_environment(kind, Some(temp_base.join("custom")));
        assert_eq!(boxed.platform_kind(), kind);
    }

    // Platform capability assertions
    assert!(PlatformKind::Linux.is_desktop());
    assert!(PlatformKind::Linux.supports_discord_presence());
    assert!(PlatformKind::Windows.is_desktop());
    assert!(PlatformKind::Windows.supports_discord_presence());
    assert!(!PlatformKind::Android.is_desktop());
    assert!(!PlatformKind::Android.supports_discord_presence());
    assert!(!PlatformKind::Ios.is_desktop());
    assert!(!PlatformKind::Ios.supports_discord_presence());

    let _ = fs::remove_dir_all(&temp_base);
}

#[test]
fn test_configuration_store_sqlite() {
    let temp_base = env::temp_dir().join(format!("scholarium_cfg_test_{}", std::process::id()));
    let _ = fs::remove_dir_all(&temp_base);

    // 1. File-backed SqliteConfigurationStore with persistence verification
    let db_path = temp_base.join("config.db");
    let mut sqlite_store = SqliteConfigurationStore::open_file(&db_path).unwrap();
    assert_eq!(sqlite_store.get("active_language").unwrap(), None);
    sqlite_store.set("active_language", "pt-BR").unwrap();
    sqlite_store.set("tts_speed", "1.2").unwrap();
    assert_eq!(
        sqlite_store.get("active_language").unwrap(),
        Some("pt-BR".to_string())
    );
    assert_eq!(
        sqlite_store.get("tts_speed").unwrap(),
        Some("1.2".to_string())
    );
    assert_eq!(sqlite_store.keys().unwrap().len(), 2);

    // Reopen file to verify on-disk persistence
    let mut reopened_store = SqliteConfigurationStore::open_file(&db_path).unwrap();
    assert_eq!(
        reopened_store.get("active_language").unwrap(),
        Some("pt-BR".to_string())
    );
    assert_eq!(
        reopened_store.get("tts_speed").unwrap(),
        Some("1.2".to_string())
    );

    reopened_store.remove("tts_speed").unwrap();
    assert_eq!(reopened_store.get("tts_speed").unwrap(), None);
    assert_eq!(
        reopened_store.keys().unwrap(),
        vec!["active_language".to_string()]
    );

    reopened_store.clear().unwrap();
    assert!(reopened_store.keys().unwrap().is_empty());

    // 2. In-memory SqliteConfigurationStore
    let mut in_memory_sqlite = SqliteConfigurationStore::new_in_memory().unwrap();
    assert_eq!(in_memory_sqlite.get("mem_key").unwrap(), None);
    in_memory_sqlite.set("mem_key", "mem_val").unwrap();
    assert_eq!(
        in_memory_sqlite.get("mem_key").unwrap(),
        Some("mem_val".to_string())
    );
    assert_eq!(
        in_memory_sqlite.keys().unwrap(),
        vec!["mem_key".to_string()]
    );
    in_memory_sqlite.remove("mem_key").unwrap();
    assert_eq!(in_memory_sqlite.get("mem_key").unwrap(), None);

    let _ = fs::remove_dir_all(&temp_base);
}

#[test]
fn test_repositories_and_storage_integration_with_platform_environment() {
    let temp_base = env::temp_dir().join(format!(
        "scholarium_integration_test_{}",
        std::process::id()
    ));
    let _ = fs::remove_dir_all(&temp_base);

    // Use Linux Flatpak environment as representative
    let env = LinuxEnvironment::new(Some(temp_base.join(".var/app/com.scholarium.reader")));

    // 1. Open SQLite highlight repository and storage for platform environment
    let mut hl_repo = SqliteHighlightRepository::open_for_platform(&env).unwrap();
    let storage = LocalFolderStorageAdapter::for_platform("flatpak-storage", &env).unwrap();
    let mut library = LibraryManager::new(storage);
    assert!(library.initialize().unwrap());

    let hl = Highlight::new(
        "hl-1",
        "sha256-tim-ferriss",
        "Lifestyle design",
        "#eab308",
        HighlightAnchor {
            format: scholarium_core::core::domain::BookFormat::Epub,
            page_number: 1,
            epub_cfi: Some("epubcfi(/6/2!/4/2)".to_string()),
            pdf_rects: None,
        },
        "Focus on efficiency",
        1000,
    );
    hl_repo.save(hl.clone()).unwrap();
    assert_eq!(
        hl_repo.find_by_id("hl-1").unwrap().unwrap().text,
        "Lifestyle design"
    );

    // 2. Open LocalFolderStorageAdapter for platform environment
    let mut storage = LocalFolderStorageAdapter::for_platform("platform-storage", &env).unwrap();
    assert!(storage.initialize().unwrap());
    storage
        .write_book_binary(
            "sha256-tim-ferriss",
            b"epub-content".to_vec(),
            BookFormat::Epub,
        )
        .unwrap();
    assert!(storage.has_book_binary("sha256-tim-ferriss").unwrap());
    assert_eq!(
        storage.read_book_binary("sha256-tim-ferriss").unwrap(),
        b"epub-content".to_vec()
    );

    // 3. Configuration Store for platform environment (SqliteConfigurationStore in scholarium.db)
    let mut sqlite_config_store = SqliteConfigurationStore::for_platform(&env).unwrap();
    sqlite_config_store
        .set("platform_setting", "enabled")
        .unwrap();
    assert_eq!(
        sqlite_config_store.get("platform_setting").unwrap(),
        Some("enabled".to_string())
    );

    let _ = fs::remove_dir_all(&temp_base);
}
