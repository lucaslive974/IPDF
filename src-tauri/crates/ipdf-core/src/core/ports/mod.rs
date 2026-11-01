pub mod book_paginator;
pub mod book_repository;
pub mod configuration_store;
pub mod export_strategy;
pub mod llm_provider;
pub mod platform_environment;
pub mod presence_provider;
pub mod repository;
pub mod storage_provider;
pub mod system_bridge;
pub mod tts_provider;

pub use book_paginator::BookPaginator;
pub use book_repository::BookRepository;
pub use configuration_store::ConfigurationStore;
pub use export_strategy::{
    ConflictResolution, ExportOptions, ExportStrategy, ImportReport, SyncPayload,
};
pub use llm_provider::{LlmRequest, ReadingContext};
pub use platform_environment::PlatformEnvironment;
pub use presence_provider::{PresenceProvider, ReadingActivity};
pub use repository::HighlightRepository;
pub use storage_provider::{StorageEntry, StorageProvider};
pub use system_bridge::{
    ClipboardService, MediaControlService, MediaMetadata, NotificationService, PlaybackState,
    PowerSaveBlocker,
};
pub use tts_provider::{SpeakOptions, TtsBoundaryEvent, TtsProvider};
