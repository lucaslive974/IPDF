use crate::seed::seed_bundled_assets_if_needed;
use crate::utils::find_file_argument;
use ipdf_core::adapters::configuration::SqliteConfigurationStore;
use ipdf_core::adapters::persistence::{SqliteBookRepository, SqliteHighlightRepository};
#[allow(unused_imports)]
use ipdf_core::adapters::platform::{
    AndroidEnvironment, IosEnvironment, LinuxEnvironment, WindowsEnvironment,
};
use ipdf_core::adapters::presence::NativeDiscordPresenceAdapter;
use ipdf_core::adapters::storage::LocalFolderStorageAdapter;
use ipdf_core::core::domain::BookMetadata;
use ipdf_core::core::ports::{ConfigurationStore, PlatformEnvironment};
use ipdf_core::core::services::{LibraryManager, RichPresenceManager};

pub struct BackendState {
    pub library: LibraryManager<LocalFolderStorageAdapter>,
    pub highlight_repo: SqliteHighlightRepository,
    pub config_store: SqliteConfigurationStore,
    pub platform_env: Box<dyn PlatformEnvironment + Send>,
    pub startup_book: Option<BookMetadata>,
    pub presence_manager: RichPresenceManager,
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

        let storage = LocalFolderStorageAdapter::for_platform("local-folder", &*platform)
            .expect("Failed to init storage for platform");

        let highlight_repo = SqliteHighlightRepository::open_for_platform(&*platform)
            .unwrap_or_else(|_| SqliteHighlightRepository::new_in_memory().unwrap());
        let book_repo = SqliteBookRepository::open_for_platform(&*platform)
            .unwrap_or_else(|_| SqliteBookRepository::new_in_memory().unwrap());
        let mut library = LibraryManager::new_with_repo(storage, book_repo);
        let _ = library.initialize();

        let mut config_store = SqliteConfigurationStore::for_platform(&*platform)
            .unwrap_or_else(|_| SqliteConfigurationStore::new_in_memory().unwrap());

        let now_ms = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis() as i64)
            .unwrap_or(0);
        seed_bundled_assets_if_needed(&mut library, &mut config_store, now_ms);

        let discord_enabled = config_store
            .get("discord_presence_enabled")
            .ok()
            .flatten()
            .map(|val| val != "false")
            .unwrap_or(true);

        let mut presence_manager = RichPresenceManager::new(3000);
        let discord_adapter = NativeDiscordPresenceAdapter::create_default(None, discord_enabled);
        presence_manager.register_provider(discord_adapter);

        let mut startup_book = None;
        let args: Vec<String> = std::env::args().collect();
        if let Some(path) = find_file_argument(&args) {
            if let Ok((metadata, _bytes)) = library.open_book_from_path(&path) {
                startup_book = Some(metadata);
            }
        }

        Self {
            library,
            highlight_repo,
            config_store,
            platform_env: platform,
            startup_book,
            presence_manager,
        }
    }
}
