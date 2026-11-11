use crate::core::domain::BookFormat;
use crate::core::ports::{
    ConflictResolution, ExportOptions, ExportStrategy, HighlightRepository, ImportReport,
    StorageProvider, SyncPayload,
};
use std::collections::{BTreeMap, BTreeSet};

pub struct DataPortabilityService {
    device_id: String,
}

impl DataPortabilityService {
    pub fn new(device_id: impl Into<String>) -> Self {
        Self {
            device_id: device_id.into(),
        }
    }

    pub fn export_data<H, S, E>(
        &self,
        highlight_repo: &H,
        storage: &mut S,
        options: &ExportOptions,
        strategy: &E,
    ) -> Result<Vec<u8>, String>
    where
        H: HighlightRepository,
        S: StorageProvider,
        E: ExportStrategy,
    {
        let mut highlights = Vec::new();
        let target_hashes = match &options.book_hashes {
            Some(hashes) => hashes.clone(),
            None => {
                let entries = storage.list_entries(None)?;
                let mut hashes = BTreeSet::new();
                for e in entries {
                    if e.name.ends_with(".epub") || e.name.ends_with(".pdf") {
                        let hash = e
                            .name
                            .trim_end_matches(".epub")
                            .trim_end_matches(".pdf")
                            .to_string();
                        hashes.insert(hash);
                    }
                }
                hashes.into_iter().collect()
            }
        };

        for hash in &target_hashes {
            highlights.extend(highlight_repo.find_by_book(hash)?);
        }

        let binaries = if options.include_book_files {
            let mut map = BTreeMap::new();
            for hash in &target_hashes {
                if storage.has_book_binary(hash)? {
                    let bytes = storage.read_book_binary(hash)?;
                    map.insert(hash.clone(), bytes);
                }
            }
            Some(map)
        } else {
            None
        };

        let payload = SyncPayload {
            schema_version: 1,
            exported_at_ms: options.exported_at_ms,
            device_id: self.device_id.clone(),
            books: Vec::new(),
            highlights,
            binaries,
        };

        strategy.serialize(&payload)
    }

    pub fn import_data<H, S, E>(
        &self,
        highlight_repo: &mut H,
        storage: &mut S,
        raw: &[u8],
        strategy: &E,
        rule: ConflictResolution,
    ) -> Result<ImportReport, String>
    where
        H: HighlightRepository,
        S: StorageProvider,
        E: ExportStrategy,
    {
        let payload = strategy.deserialize(raw)?;
        let mut report = ImportReport::default();

        for incoming_hl in &payload.highlights {
            match highlight_repo.find_by_id(&incoming_hl.id)? {
                None => {
                    highlight_repo.save(incoming_hl.clone())?;
                    report.highlights_added += 1;
                }
                Some(local_hl) => {
                    report.conflicts_resolved += 1;
                    if Self::should_overwrite(
                        local_hl.updated_at_ms,
                        incoming_hl.updated_at_ms,
                        rule,
                    ) {
                        highlight_repo.update(incoming_hl.clone())?;
                        report.highlights_updated += 1;
                    }
                }
            }
        }

        if let Some(binaries) = payload.binaries {
            for (book_hash, binary_data) in binaries {
                if !storage.has_book_binary(&book_hash)? {
                    storage.write_book_binary(&book_hash, binary_data, BookFormat::Epub)?;
                    report.binaries_restored += 1;
                }
            }
        }

        Ok(report)
    }

    fn should_overwrite(local_ts: i64, incoming_ts: i64, rule: ConflictResolution) -> bool {
        match rule {
            ConflictResolution::LastWriteWins => incoming_ts >= local_ts,
            ConflictResolution::KeepLocal => false,
            ConflictResolution::KeepImported => true,
        }
    }
}
