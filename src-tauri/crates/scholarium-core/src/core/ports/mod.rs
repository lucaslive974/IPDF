pub mod backup_destination;
pub mod book_cover_extractor;
pub mod book_paginator;
pub mod book_repository;
pub mod configuration_store;
pub mod export_strategy;
pub mod llm_provider;
pub mod logging;
pub mod platform_environment;
pub mod presence_provider;
pub mod repository;
pub mod storage_provider;
pub mod system_bridge;
pub mod tts_provider;

pub use backup_destination::{
    format_backup_filename, parse_backup_filename, BackupArtifact, BackupDestination, BackupReport,
};
pub use book_cover_extractor::{BookCoverExtractor, ExtractedCover};
pub use book_paginator::BookPaginator;
pub use book_repository::BookRepository;
pub use configuration_store::ConfigurationStore;
pub use export_strategy::{
    ConflictResolution, ExportOptions, ExportStrategy, ImportReport, SyncPayload,
};
pub use llm_provider::{LlmRequest, ReadingContext};
pub use logging::{LogEntry, LogLevel, LogService};
pub use platform_environment::{sanitize_device_label, PlatformEnvironment};
pub use presence_provider::{PresenceActivity, PresenceHealth, PresenceProvider, ReadingActivity};
pub use repository::HighlightRepository;
pub use storage_provider::{StorageEntry, StorageProvider};
pub use system_bridge::{
    ClipboardService, MediaControlService, MediaMetadata, NotificationService, PlaybackState,
    PowerSaveBlocker,
};
pub use tts_provider::{SpeakOptions, TtsBoundaryEvent, TtsProvider};
