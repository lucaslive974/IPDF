use crate::core::domain::BookFormat;
use crate::core::ports::{
    BookRepository, ConflictResolution, ExportOptions, ExportStrategy, HighlightRepository,
    ImportReport, StorageProvider, SyncPayload,
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

    pub fn export_data<B, H, S, E>(
        &self,
        book_repo: &B,
        highlight_repo: &H,
        storage: &mut S,
        options: &ExportOptions,
        strategy: &E,
    ) -> Result<Vec<u8>, String>
    where
        B: BookRepository,
        H: HighlightRepository,
        S: StorageProvider,
        E: ExportStrategy,
    {
        let all_books = book_repo.find_all()?;
        let target_books: Vec<_> = match &options.book_hashes {
            Some(hashes) => all_books
                .into_iter()
                .filter(|b| hashes.contains(&b.book_hash))
                .collect(),
            None => all_books,
        };

        let mut highlights = Vec::new();
        let mut covered_hashes = BTreeSet::new();
        for book in &target_books {
            covered_hashes.insert(book.book_hash.clone());
            highlights.extend(highlight_repo.find_by_book(&book.book_hash)?);
        }

        if let Some(ref hashes) = options.book_hashes {
            for hash in hashes {
                if !covered_hashes.contains(hash) {
                    highlights.extend(highlight_repo.find_by_book(hash)?);
                }
            }
        }

        let binaries = if options.include_book_files {
            let mut map = BTreeMap::new();
            for book in &target_books {
                if storage.has_book_binary(&book.book_hash)? {
                    let bytes = storage.read_book_binary(&book.book_hash)?;
                    map.insert(book.book_hash.clone(), bytes);
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
            books: target_books,
            highlights,
            binaries,
        };

        strategy.serialize(&payload)
    }

    pub fn import_data<B, H, S, E>(
        &self,
        book_repo: &mut B,
        highlight_repo: &mut H,
        storage: &mut S,
        raw: &[u8],
        strategy: &E,
        rule: ConflictResolution,
    ) -> Result<ImportReport, String>
    where
        B: BookRepository,
        H: HighlightRepository,
        S: StorageProvider,
        E: ExportStrategy,
    {
        let payload = strategy.deserialize(raw)?;
        let mut report = ImportReport::default();

        for incoming_book in &payload.books {
            match book_repo.find_by_id(&incoming_book.book_hash)? {
                None => {
                    book_repo.save(incoming_book.clone())?;
                    report.books_imported += 1;
                }
                Some(local_book) => {
                    report.conflicts_resolved += 1;
                    if Self::should_overwrite(
                        local_book.updated_at_ms,
                        incoming_book.updated_at_ms,
                        rule,
                    ) {
                        book_repo.update(incoming_book.clone())?;
                        report.books_updated += 1;
                    }
                }
            }
        }

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
                    let format = book_repo
                        .find_by_id(&book_hash)?
                        .map(|b| b.format)
                        .unwrap_or(BookFormat::Epub);
                    storage.write_book_binary(&book_hash, binary_data, format)?;
                    report.binaries_restored += 1;
                }
            }
        }

        Ok(report)
    }

    fn should_overwrite(local_ms: i64, incoming_ms: i64, rule: ConflictResolution) -> bool {
        match rule {
            ConflictResolution::KeepLocal => false,
            ConflictResolution::KeepImported => true,
            ConflictResolution::LastWriteWins => incoming_ms > local_ms,
        }
    }
}
