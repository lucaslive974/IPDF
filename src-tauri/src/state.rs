use crate::seed::seed_bundled_assets_if_needed;
use crate::utils::find_file_argument;
#[cfg(feature = "cloud-sync")]
use scholarium_core::adapters::cloud::{
    FileCloudCredentialStore, GoogleDriveAppDataAdapter, GoogleOAuthConfig, GoogleOAuthPkceAdapter,
    PkceChallenge, UreqHttpTransport,
};
use scholarium_core::adapters::configuration::SqliteConfigurationStore;
use scholarium_core::adapters::logging::AsyncFileLogger;
use scholarium_core::adapters::pagination::EpubBookPaginator;
use scholarium_core::adapters::persistence::{SqliteBookRepository, SqliteHighlightRepository};
#[allow(unused_imports)]
use scholarium_core::adapters::platform::{
    AndroidEnvironment, IosEnvironment, LinuxEnvironment, WindowsEnvironment,
};
use scholarium_core::adapters::presence::NativeDiscordPresenceAdapter;
use scholarium_core::adapters::storage::{LocalFolderStorageAdapter, StorageManagerDecorator};
use scholarium_core::core::domain::BookMetadata;
#[cfg(feature = "cloud-sync")]
use scholarium_core::core::ports::{CloudAuthProvider, CloudStorageProvider};
use scholarium_core::core::ports::{
    ConfigurationStore, LogEntry, LogLevel, LogService, PlatformEnvironment,
};
use scholarium_core::core::services::{EpubContentService, LibraryManager, RichPresenceManager};
#[cfg(feature = "cloud-sync")]
use std::sync::Arc;

pub type AppStorage = StorageManagerDecorator<LocalFolderStorageAdapter>;

#[cfg(feature = "cloud-sync")]
pub struct PendingGoogleOAuth {
    pub pkce: PkceChallenge,
    pub adapter: Arc<GoogleOAuthPkceAdapter>,
}

pub struct BackendState {
    pub storage: AppStorage,
    pub library: LibraryManager<AppStorage>,
    pub epub_content: EpubContentService<AppStorage, EpubBookPaginator>,
    pub highlight_repo: SqliteHighlightRepository,
    pub config_store: SqliteConfigurationStore,
    pub platform_env: Box<dyn PlatformEnvironment + Send>,
    pub startup_book: Option<BookMetadata>,
    pub presence_manager: RichPresenceManager,
    pub logger: AsyncFileLogger,
    #[cfg(feature = "cloud-sync")]
    pub credential_store: Arc<FileCloudCredentialStore>,
    #[cfg(feature = "cloud-sync")]
    pub cloud_auth: Option<Arc<GoogleOAuthPkceAdapter>>,
    #[cfg(feature = "cloud-sync")]
    pub pending_oauth: Option<PendingGoogleOAuth>,
}

impl Default for BackendState {
    fn default() -> Self {
        #[cfg(target_os = "windows")]
        let platform: Box<dyn PlatformEnvironment + Send> = Box::new(WindowsEnvironment::default());
        #[cfg(target_os = "ios")]
        let platform: Box<dyn PlatformEnvironment + Send> = Box::new(IosEnvironment::default());
        #[cfg(target_os = "android")]
        let platform: Box<dyn PlatformEnvironment + Send> = Box::new(AndroidEnvironment::default());
        #[cfg(not(any(target_os = "windows", target_os = "ios", target_os = "android")))]
        let platform: Box<dyn PlatformEnvironment + Send> = Box::new(LinuxEnvironment::default());

        let logger = AsyncFileLogger::for_platform(&*platform, true).unwrap_or_else(|_| {
            AsyncFileLogger::new(std::env::temp_dir().join("scholarium-logs"), true)
                .expect("Failed to initialize fallback logger")
        });
        logger.install_global();

        let local_storage = LocalFolderStorageAdapter::for_platform("local-folder", &*platform)
            .expect("Failed to init storage for platform");
        let mut storage = StorageManagerDecorator::new_local_only(local_storage);

        let highlight_repo = SqliteHighlightRepository::open_for_platform(&*platform)
            .unwrap_or_else(|err| {
                let _ = logger.log(LogEntry::new(
                    crate::utils::current_epoch_ms(),
                    LogLevel::Error,
                    "sqlite",
                    format!("Highlight repo fallback to in-memory: {err}"),
                ));
                SqliteHighlightRepository::new_in_memory().unwrap()
            });
        let book_repo = SqliteBookRepository::open_for_platform(&*platform).unwrap_or_else(|err| {
            let _ = logger.log(LogEntry::new(
                crate::utils::current_epoch_ms(),
                LogLevel::Error,
                "sqlite",
                format!("Book repo fallback to in-memory: {err}"),
            ));
            SqliteBookRepository::new_in_memory().unwrap()
        });
        let mut library = LibraryManager::new_with_repo(storage.clone(), book_repo);
        if let Err(err) = library.initialize() {
            let _ = logger.log(LogEntry::new(
                crate::utils::current_epoch_ms(),
                LogLevel::Error,
                "library",
                format!("Library initialization failed: {err}"),
            ));
        }
        let epub_content = EpubContentService::new(storage.clone(), EpubBookPaginator::new());

        let mut config_store =
            SqliteConfigurationStore::for_platform(&*platform).unwrap_or_else(|err| {
                let _ = logger.log(LogEntry::new(
                    crate::utils::current_epoch_ms(),
                    LogLevel::Error,
                    "sqlite",
                    format!("Config store fallback to in-memory: {err}"),
                ));
                SqliteConfigurationStore::new_in_memory().unwrap()
            });

        let now_ms = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis() as i64)
            .unwrap_or(0);
        seed_bundled_assets_if_needed(&mut library, &mut storage, &mut config_store, now_ms);

        let discord_enabled = config_store
            .get("discord_presence_enabled")
            .ok()
            .flatten()
            .map(|val| val != "false")
            .unwrap_or(true);

        let discord_client_id = config_store
            .get("discord_client_id")
            .ok()
            .flatten()
            .and_then(|id_str| id_str.parse::<u64>().ok());

        let supports_discord = platform.platform_kind().supports_discord_presence()
            && cfg!(not(any(target_os = "android", target_os = "ios")));

        let now = crate::utils::current_epoch_ms();
        let mut presence_manager = RichPresenceManager::new_with_start_time(3000, now);
        if supports_discord {
            let discord_adapter =
                NativeDiscordPresenceAdapter::create_default(discord_client_id, discord_enabled);
            presence_manager.register_provider(discord_adapter);
        }

        #[cfg(feature = "cloud-sync")]
        let credential_store = Arc::new(
            FileCloudCredentialStore::for_platform(&*platform).unwrap_or_else(|_| {
                FileCloudCredentialStore::new(std::env::temp_dir().join(
                    scholarium_core::core::domain::AppStoragePaths::CLOUD_CREDENTIALS_FILENAME,
                ))
            }),
        );
        #[cfg(feature = "cloud-sync")]
        let cloud_auth = restore_google_session(&credential_store);
        #[cfg(feature = "cloud-sync")]
        if let Some(ref auth) = cloud_auth {
            let remote: Arc<dyn CloudStorageProvider> = Arc::new(GoogleDriveAppDataAdapter::new(
                auth.clone(),
                Arc::new(UreqHttpTransport::new()),
            ));
            storage.set_remote(Some(remote));
        }

        let args: Vec<String> = std::env::args().collect();
        let startup_book = Self::import_book_from_cli_args(&mut library, &epub_content, &args);

        Self {
            storage,
            library,
            epub_content,
            highlight_repo,
            config_store,
            platform_env: platform,
            startup_book,
            presence_manager,
            logger,
            #[cfg(feature = "cloud-sync")]
            credential_store,
            #[cfg(feature = "cloud-sync")]
            cloud_auth,
            #[cfg(feature = "cloud-sync")]
            pending_oauth: None,
        }
    }
}

#[cfg(feature = "cloud-sync")]
fn restore_google_session(
    credential_store: &Arc<FileCloudCredentialStore>,
) -> Option<Arc<GoogleOAuthPkceAdapter>> {
    let cfg = GoogleOAuthConfig::resolve("http://127.0.0.1:42813/oauth/callback").ok()?;
    let adapter = Arc::new(GoogleOAuthPkceAdapter::new(
        cfg,
        credential_store.clone(),
        Arc::new(UreqHttpTransport::new()),
    ));
    if adapter.session().ok()?.connected {
        Some(adapter)
    } else {
        None
    }
}

impl BackendState {
    pub(crate) fn import_book_from_cli_args(
        library: &mut LibraryManager<AppStorage>,
        epub_content: &EpubContentService<AppStorage, EpubBookPaginator>,
        args: &[String],
    ) -> Option<BookMetadata> {
        let path = find_file_argument(args)?;
        let file = crate::utils::read_local_book_file(&path).ok()?;
        let total_pages = if file.format == scholarium_core::core::domain::BookFormat::Pdf {
            1
        } else {
            epub_content.count_pages_from_bytes(&file.raw_bytes)
        };
        library
            .import_book(scholarium_core::core::services::ImportBookInput {
                raw_bytes: file.raw_bytes,
                title: file.title,
                author: "Unknown".to_string(),
                format: file.format,
                total_pages,
                now_ms: crate::utils::current_epoch_ms(),
            })
            .ok()
    }
}
