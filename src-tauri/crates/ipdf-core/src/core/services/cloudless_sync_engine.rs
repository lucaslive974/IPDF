use crate::core::ports::{
    ConflictResolution, ExportOptions, ExportStrategy, HighlightRepository, StorageProvider,
};
use crate::core::services::data_portability_service::DataPortabilityService;

pub struct CloudlessSyncEngine {
    portability: DataPortabilityService,
}

impl CloudlessSyncEngine {
    pub const LIBRARY_INDEX_FILE: &'static str = ".reader_library_index.json";

    pub fn new(portability: DataPortabilityService) -> Self {
        Self { portability }
    }

    pub fn sync_book_state<H, S, E>(
        &self,
        book_hash: &str,
        highlight_repo: &mut H,
        storage: &mut S,
        strategy: &E,
        now_ms: i64,
    ) -> Result<(), String>
    where
        H: HighlightRepository,
        S: StorageProvider,
        E: ExportStrategy,
    {
        if !storage.is_available() {
            return Ok(());
        }

        let file_name = format!("{book_hash}.highlights.json");
        if let Some(existing_bytes) = storage.read_entry(&file_name)? {
            self.portability.import_data(
                highlight_repo,
                storage,
                &existing_bytes,
                strategy,
                ConflictResolution::LastWriteWins,
            )?;
        }

        let options = ExportOptions {
            book_hashes: Some(vec![book_hash.to_string()]),
            include_book_files: false,
            exported_at_ms: now_ms,
        };
        let merged = self
            .portability
            .export_data(highlight_repo, storage, &options, strategy)?;

        storage.write_entry(&file_name, &merged, "application/json")?;
        Ok(())
    }

    pub fn sync_library_index<H, S, E>(
        &self,
        highlight_repo: &mut H,
        storage: &mut S,
        strategy: &E,
        now_ms: i64,
    ) -> Result<(), String>
    where
        H: HighlightRepository,
        S: StorageProvider,
        E: ExportStrategy,
    {
        if !storage.is_available() {
            return Ok(());
        }

        if let Some(existing_bytes) = storage.read_entry(Self::LIBRARY_INDEX_FILE)? {
            self.portability.import_data(
                highlight_repo,
                storage,
                &existing_bytes,
                strategy,
                ConflictResolution::LastWriteWins,
            )?;
        }

        let options = ExportOptions {
            book_hashes: None,
            include_book_files: false,
            exported_at_ms: now_ms,
        };
        let updated = self
            .portability
            .export_data(highlight_repo, storage, &options, strategy)?;

        storage.write_entry(Self::LIBRARY_INDEX_FILE, &updated, "application/json")?;
        Ok(())
    }
}
