use crate::core::domain::{
    BookFormat, BookMetadata, BookSyncMetadata, BookSyncProgress, BookSyncState, Highlight,
    HighlightSyncEntry, ManifestBookEntry, SyncManifest, SyncReport,
};
use crate::core::ports::{
    BookRepository, CloudStorageError, CloudStorageProvider, ConfigurationStore,
    HighlightRepository, StorageProvider,
};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};

fn err_string<E: std::fmt::Display>(err: E) -> String {
    err.to_string()
}

/// Canonical cloud object path helpers shared by `CloudSyncEngine` and `StorageManagerDecorator`.
pub struct CloudSyncPaths;

impl CloudSyncPaths {
    pub const MANIFEST: &'static str = "sync-manifest.json";
    pub const CURSOR_CONFIG_KEY: &'static str = "cloud_sync_cursor";

    pub fn book_state(book_hash: &str) -> String {
        format!("state/{book_hash}.json")
    }

    pub fn book_blob(book_hash: &str, format: BookFormat) -> String {
        let ext = match format {
            BookFormat::Epub => "epub",
            BookFormat::Pdf => "pdf",
        };
        format!("blobs/books/{book_hash}.{ext}")
    }

    pub fn cover_blob(book_hash: &str) -> String {
        format!("blobs/covers/{book_hash}")
    }
}

/// Persistent local sync cursor stored in `ConfigurationStore` (tracks ETags and deletion tombstones).
#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalSyncCursor {
    pub last_manifest_etag: Option<String>,
    pub last_revision: u64,
    #[serde(default)]
    pub synced_book_hashes: BTreeSet<String>,
    #[serde(default)]
    pub deleted_books: BTreeMap<String, i64>,
    #[serde(default)]
    pub deleted_highlights: BTreeMap<String, BTreeMap<String, i64>>,
}

impl LocalSyncCursor {
    pub fn load<C: ConfigurationStore>(config: &C) -> Result<Self, String> {
        match config.get(CloudSyncPaths::CURSOR_CONFIG_KEY)? {
            Some(raw) if !raw.trim().is_empty() => {
                serde_json::from_str(&raw).map_err(|e| format!("Invalid sync cursor JSON: {e}"))
            }
            _ => Ok(Self::default()),
        }
    }

    pub fn save<C: ConfigurationStore>(&self, config: &mut C) -> Result<(), String> {
        let raw = serde_json::to_string(self).map_err(err_string)?;
        config.set(CloudSyncPaths::CURSOR_CONFIG_KEY, &raw)
    }

    pub fn record_deleted_book(&mut self, book_hash: impl Into<String>, deleted_at_ms: i64) {
        let hash = book_hash.into();
        self.synced_book_hashes.remove(&hash);
        self.deleted_books.insert(hash, deleted_at_ms);
    }

    pub fn record_deleted_highlight(
        &mut self,
        book_hash: impl Into<String>,
        highlight_id: impl Into<String>,
        deleted_at_ms: i64,
    ) {
        self.deleted_highlights
            .entry(book_hash.into())
            .or_default()
            .insert(highlight_id.into(), deleted_at_ms);
    }
}

/// Pure Last-Write-Wins (LWW) semantic merger for a single book's mutable state.
pub fn merge_book_states(local: &BookSyncState, remote: &BookSyncState) -> BookSyncState {
    let metadata = if local.metadata.updated_at_ms >= remote.metadata.updated_at_ms {
        local.metadata.clone()
    } else {
        remote.metadata.clone()
    };

    let progress = if local.progress.updated_at_ms >= remote.progress.updated_at_ms {
        local.progress.clone()
    } else {
        remote.progress.clone()
    };

    let mut highlights = local.highlights.clone();
    for (id, remote_entry) in &remote.highlights {
        match highlights.get(id) {
            Some(local_entry) if local_entry.updated_at_ms > remote_entry.updated_at_ms => {}
            Some(local_entry)
                if local_entry.updated_at_ms == remote_entry.updated_at_ms
                    && !remote_entry.is_deleted() => {}
            _ => {
                highlights.insert(id.clone(), remote_entry.clone());
            }
        }
    }

    BookSyncState {
        book_hash: local.book_hash.clone(),
        metadata,
        progress,
        highlights,
    }
}

enum AttemptOutcome {
    Completed(SyncReport),
    Retry,
}

enum BookReconciliation {
    Entry {
        manifest_entry: ManifestBookEntry,
        state_to_push: Option<Vec<u8>>,
    },
    Skip,
}

/// Optimistic-concurrency cloud synchronization engine (no `.lock` files, no background heartbeats).
///
/// Synchronizes lightweight manifest, per-book mutable states (metadata, reading progress,
/// highlights with tombstones), and cover images. Heavy book binaries are uploaded once
/// content-addressed by SHA-256 and downloaded on demand by `StorageManagerDecorator`.
pub struct CloudSyncEngine {
    max_commit_retries: usize,
}

impl Default for CloudSyncEngine {
    fn default() -> Self {
        Self::new()
    }
}

impl CloudSyncEngine {
    pub const DEFAULT_MAX_RETRIES: usize = 3;

    pub fn new() -> Self {
        Self {
            max_commit_retries: Self::DEFAULT_MAX_RETRIES,
        }
    }

    pub fn with_max_retries(max_commit_retries: usize) -> Self {
        Self {
            max_commit_retries: max_commit_retries.max(1),
        }
    }

    /// Cheap ETag check against `sync-manifest.json` (`HEAD` only, 0 payload bytes).
    pub fn check_remote_changed<C, P>(&self, config: &C, cloud: &P) -> Result<bool, String>
    where
        C: ConfigurationStore,
        P: CloudStorageProvider + ?Sized,
    {
        let cursor = LocalSyncCursor::load(config)?;
        let remote_etag = cloud
            .head(CloudSyncPaths::MANIFEST)
            .map_err(err_string)?
            .map(|m| m.etag);
        Ok(remote_etag != cursor.last_manifest_etag)
    }

    /// Executes a complete optimistic-concurrency sync cycle using an internal `SyncSession`.
    pub fn sync_once<B, H, S, C, P>(
        &self,
        book_repo: &mut B,
        highlight_repo: &mut H,
        storage: &mut S,
        config: &mut C,
        cloud: &P,
        now_ms: i64,
    ) -> Result<SyncReport, String>
    where
        B: BookRepository,
        H: HighlightRepository,
        S: StorageProvider,
        C: ConfigurationStore,
        P: CloudStorageProvider + ?Sized,
    {
        let mut session = SyncSession {
            book_repo,
            highlight_repo,
            storage,
            config,
            cloud,
            now_ms,
            max_commit_retries: self.max_commit_retries,
            cursor: LocalSyncCursor::default(),
            report: SyncReport::default(),
        };
        session.execute()
    }
}

/// Scoped execution session holding borrowed repositories and sync state for a single `sync_once` call.
struct SyncSession<'a, B, H, S, C, P: ?Sized> {
    book_repo: &'a mut B,
    highlight_repo: &'a mut H,
    storage: &'a mut S,
    config: &'a mut C,
    cloud: &'a P,
    now_ms: i64,
    max_commit_retries: usize,
    cursor: LocalSyncCursor,
    report: SyncReport,
}

impl<'a, B, H, S, C, P> SyncSession<'a, B, H, S, C, P>
where
    B: BookRepository,
    H: HighlightRepository,
    S: StorageProvider,
    C: ConfigurationStore,
    P: CloudStorageProvider + ?Sized,
{
    fn execute(&mut self) -> Result<SyncReport, String> {
        let uploaded_blobs = self.upload_missing_local_blobs()?;

        let mut retries = 0usize;
        loop {
            match self.run_attempt(uploaded_blobs, retries)? {
                AttemptOutcome::Completed(report) => return Ok(report),
                AttemptOutcome::Retry => retries += 1,
            }
        }
    }

    fn run_attempt(
        &mut self,
        uploaded_blobs: usize,
        retries: usize,
    ) -> Result<AttemptOutcome, String> {
        self.cursor = LocalSyncCursor::load(self.config)?;
        let (remote_manifest_opt, remote_etag) = self.read_remote_manifest()?;
        let remote_manifest = remote_manifest_opt
            .clone()
            .unwrap_or_else(|| SyncManifest::new_empty(self.now_ms));

        self.report = SyncReport {
            revision: remote_manifest.revision,
            uploaded_blobs,
            retries,
            synced_at_ms: self.now_ms,
            ..SyncReport::default()
        };

        let local_books: BTreeMap<String, BookMetadata> = self
            .book_repo
            .list_books()?
            .into_iter()
            .map(|b| (b.book_hash.clone(), b))
            .collect();
        self.record_implicit_local_deletions(&local_books);

        let all_hashes = self.collect_all_book_hashes(&local_books, &remote_manifest);
        let mut next_books_manifest = BTreeMap::new();
        let mut states_to_push = Vec::new();

        for book_hash in all_hashes {
            let local_book = local_books.get(&book_hash);
            let remote_entry = remote_manifest.books.get(&book_hash);
            if let BookReconciliation::Entry {
                manifest_entry,
                state_to_push,
            } = self.reconcile_book(&book_hash, local_book, remote_entry)?
            {
                if let Some(bytes) = state_to_push {
                    states_to_push.push((book_hash.clone(), bytes));
                }
                next_books_manifest.insert(book_hash, manifest_entry);
            }
        }

        self.push_changed_states(&states_to_push)?;

        let manifest_changed = next_books_manifest != remote_manifest.books
            || (remote_manifest_opt.is_none() && !next_books_manifest.is_empty());

        if !manifest_changed {
            self.cursor.last_manifest_etag = remote_etag;
            self.cursor.last_revision = remote_manifest.revision;
            self.cursor.save(self.config)?;
            self.report.revision = remote_manifest.revision;
            return Ok(AttemptOutcome::Completed(self.report.clone()));
        }

        self.commit_manifest(
            remote_manifest.revision,
            remote_etag.as_deref(),
            next_books_manifest,
            retries,
        )
    }

    fn reconcile_book(
        &mut self,
        book_hash: &str,
        local_book: Option<&BookMetadata>,
        remote_entry: Option<&ManifestBookEntry>,
    ) -> Result<BookReconciliation, String> {
        if let Some(tombstone_entry) =
            self.resolve_book_deletion(book_hash, local_book, remote_entry)?
        {
            return Ok(BookReconciliation::Entry {
                manifest_entry: tombstone_entry,
                state_to_push: None,
            });
        }

        let local_state = match local_book {
            Some(book) => Some(self.build_local_book_state(book)?),
            None => None,
        };
        let local_state_hash = match &local_state {
            Some(st) => Some(st.compute_state_hash()?),
            None => None,
        };

        let should_pull = match (remote_entry, &local_state_hash) {
            (Some(re), Some(lh)) => !re.is_deleted() && re.state_hash != *lh,
            (Some(re), None) => !re.is_deleted(),
            (None, _) => false,
        };

        let Some(final_state) = (if should_pull {
            self.pull_and_merge_book(book_hash, local_state.as_ref(), remote_entry)?
        } else {
            local_state
        }) else {
            return Ok(BookReconciliation::Skip);
        };

        let final_hash = final_state.compute_state_hash()?;
        let remote_matches = remote_entry
            .map(|re| !re.is_deleted() && re.state_hash == final_hash)
            .unwrap_or(false);

        let state_to_push = if !remote_matches {
            self.report.pushed_books += 1;
            Some(serde_json::to_vec(&final_state).map_err(err_string)?)
        } else {
            None
        };

        let cover_mime = if let Some((_, mime)) = self.storage.read_book_cover(book_hash)? {
            Some(mime)
        } else {
            remote_entry.and_then(|re| re.cover_mime_type.clone())
        };
        let file_size = if self.storage.has_book_binary(book_hash)? {
            self.storage.get_book_size(book_hash).ok()
        } else {
            remote_entry.and_then(|re| re.file_size_bytes)
        };

        self.cursor.synced_book_hashes.insert(book_hash.to_string());
        Ok(BookReconciliation::Entry {
            manifest_entry: ManifestBookEntry {
                state_hash: final_hash,
                format: final_state.metadata.format,
                cover_mime_type: cover_mime,
                file_size_bytes: file_size,
                updated_at_ms: final_state
                    .metadata
                    .updated_at_ms
                    .max(final_state.progress.updated_at_ms),
                deleted_at_ms: None,
            },
            state_to_push,
        })
    }

    fn resolve_book_deletion(
        &mut self,
        book_hash: &str,
        local_book: Option<&BookMetadata>,
        remote_entry: Option<&ManifestBookEntry>,
    ) -> Result<Option<ManifestBookEntry>, String> {
        let local_deleted_at = self.cursor.deleted_books.get(book_hash).copied();
        let remote_deleted_at = remote_entry.and_then(|e| e.deleted_at_ms);

        let effective_delete = match (local_deleted_at, remote_deleted_at) {
            (Some(a), Some(b)) => Some(a.max(b)),
            (Some(a), None) => Some(a),
            (None, Some(b)) => Some(b),
            (None, None) => None,
        };

        let Some(deleted_at) = effective_delete else {
            return Ok(None);
        };

        let local_is_newer = local_book
            .map(|b| b.updated_at_ms > deleted_at)
            .unwrap_or(false);
        if local_is_newer {
            self.cursor.deleted_books.remove(book_hash);
            return Ok(None);
        }

        if local_book.is_some() {
            self.book_repo.delete_book(book_hash)?;
            let _ = self.highlight_repo.delete_by_book(book_hash);
            let _ = self.storage.delete_book_cover(book_hash);
            self.report.deleted_books += 1;
        }

        self.cursor.record_deleted_book(book_hash, deleted_at);
        Ok(Some(ManifestBookEntry {
            state_hash: String::new(),
            format: remote_entry.map(|e| e.format).unwrap_or(BookFormat::Epub),
            cover_mime_type: None,
            file_size_bytes: None,
            updated_at_ms: deleted_at,
            deleted_at_ms: Some(deleted_at),
        }))
    }

    fn pull_and_merge_book(
        &mut self,
        book_hash: &str,
        local_state: Option<&BookSyncState>,
        remote_entry: Option<&ManifestBookEntry>,
    ) -> Result<Option<BookSyncState>, String> {
        let remote_state_path = CloudSyncPaths::book_state(book_hash);
        let remote_state = match self.cloud.read(&remote_state_path).map_err(err_string)? {
            Some((bytes, _)) => serde_json::from_slice::<BookSyncState>(&bytes)
                .map_err(|e| format!("Invalid remote state for {book_hash}: {e}"))?,
            None => return Ok(local_state.cloned()),
        };

        let merged = match local_state {
            Some(ls) => merge_book_states(ls, &remote_state),
            None => remote_state,
        };

        self.apply_book_sync_state(&merged)?;
        self.report.pulled_books += 1;

        if let Some(cover_mime) = remote_entry.and_then(|re| re.cover_mime_type.as_deref()) {
            self.download_cover_if_missing(book_hash, cover_mime)?;
        }

        Ok(Some(merged))
    }

    fn download_cover_if_missing(
        &mut self,
        book_hash: &str,
        cover_mime: &str,
    ) -> Result<(), String> {
        if self.storage.read_book_cover(book_hash)?.is_some() {
            return Ok(());
        }
        if let Some((cover_bytes, _)) = self
            .cloud
            .read(&CloudSyncPaths::cover_blob(book_hash))
            .map_err(err_string)?
        {
            self.storage
                .write_book_cover(book_hash, &cover_bytes, cover_mime)?;
            self.report.downloaded_covers += 1;
        }
        Ok(())
    }

    fn push_changed_states(&self, states_to_push: &[(String, Vec<u8>)]) -> Result<(), String> {
        for (book_hash, state_bytes) in states_to_push {
            self.cloud
                .write_unconditional(
                    &CloudSyncPaths::book_state(book_hash),
                    state_bytes,
                    "application/json",
                )
                .map_err(err_string)?;
        }
        Ok(())
    }

    fn commit_manifest(
        &mut self,
        current_revision: u64,
        remote_etag: Option<&str>,
        next_books_manifest: BTreeMap<String, ManifestBookEntry>,
        retries: usize,
    ) -> Result<AttemptOutcome, String> {
        let next_revision = current_revision.saturating_add(1);
        let next_manifest = SyncManifest {
            schema_version: SyncManifest::CURRENT_SCHEMA_VERSION,
            revision: next_revision,
            updated_at_ms: self.now_ms,
            books: next_books_manifest,
        };
        let manifest_bytes = serde_json::to_vec(&next_manifest).map_err(err_string)?;

        let commit_result = match remote_etag {
            Some(etag) => self.cloud.write_if_match(
                CloudSyncPaths::MANIFEST,
                &manifest_bytes,
                "application/json",
                etag,
            ),
            None => self.cloud.write_if_absent(
                CloudSyncPaths::MANIFEST,
                &manifest_bytes,
                "application/json",
            ),
        };

        match commit_result {
            Ok(new_meta) => {
                self.cursor.last_manifest_etag = Some(new_meta.etag);
                self.cursor.last_revision = next_revision;
                self.cursor.save(self.config)?;
                self.report.revision = next_revision;
                Ok(AttemptOutcome::Completed(self.report.clone()))
            }
            Err(CloudStorageError::PreconditionFailed(_)) if retries < self.max_commit_retries => {
                Ok(AttemptOutcome::Retry)
            }
            Err(err) => Err(err.to_string()),
        }
    }

    fn read_remote_manifest(&self) -> Result<(Option<SyncManifest>, Option<String>), String> {
        match self
            .cloud
            .read(CloudSyncPaths::MANIFEST)
            .map_err(err_string)?
        {
            Some((bytes, meta)) => {
                let manifest: SyncManifest = serde_json::from_slice(&bytes)
                    .map_err(|e| format!("Invalid remote sync-manifest.json: {e}"))?;
                Ok((Some(manifest), Some(meta.etag)))
            }
            None => Ok((None, None)),
        }
    }

    fn upload_missing_local_blobs(&mut self) -> Result<usize, String> {
        let mut uploaded = 0usize;
        for book in self.book_repo.list_books()? {
            if self.storage.has_book_binary(&book.book_hash)? {
                let blob_path = CloudSyncPaths::book_blob(&book.book_hash, book.format);
                if self.cloud.head(&blob_path).map_err(err_string)?.is_none() {
                    let bytes = self.storage.read_book_binary(&book.book_hash)?;
                    let content_type = match book.format {
                        BookFormat::Epub => "application/epub+zip",
                        BookFormat::Pdf => "application/pdf",
                    };
                    self.cloud
                        .write_unconditional(&blob_path, &bytes, content_type)
                        .map_err(err_string)?;
                    uploaded += 1;
                }
            }

            if let Some((cover_bytes, cover_mime)) =
                self.storage.read_book_cover(&book.book_hash)?
            {
                let cover_path = CloudSyncPaths::cover_blob(&book.book_hash);
                if self.cloud.head(&cover_path).map_err(err_string)?.is_none() {
                    self.cloud
                        .write_unconditional(&cover_path, &cover_bytes, &cover_mime)
                        .map_err(err_string)?;
                }
            }
        }
        Ok(uploaded)
    }

    fn record_implicit_local_deletions(&mut self, local_books: &BTreeMap<String, BookMetadata>) {
        let stale_synced: Vec<String> = self
            .cursor
            .synced_book_hashes
            .iter()
            .filter(|hash| !local_books.contains_key(*hash))
            .cloned()
            .collect();
        for hash in stale_synced {
            self.cursor.record_deleted_book(hash, self.now_ms);
        }
    }

    fn collect_all_book_hashes(
        &self,
        local_books: &BTreeMap<String, BookMetadata>,
        remote_manifest: &SyncManifest,
    ) -> BTreeSet<String> {
        let mut all_hashes = BTreeSet::new();
        all_hashes.extend(local_books.keys().cloned());
        all_hashes.extend(remote_manifest.books.keys().cloned());
        all_hashes.extend(self.cursor.deleted_books.keys().cloned());
        all_hashes
    }

    fn build_local_book_state(&self, book: &BookMetadata) -> Result<BookSyncState, String> {
        let highlights: Vec<Highlight> = self.highlight_repo.find_by_book(&book.book_hash)?;
        let mut highlight_map = BTreeMap::new();
        for h in highlights {
            highlight_map.insert(h.id.clone(), HighlightSyncEntry::active(h));
        }
        if let Some(tombstones) = self.cursor.deleted_highlights.get(&book.book_hash) {
            for (id, deleted_at_ms) in tombstones {
                match highlight_map.get(id) {
                    Some(existing) if existing.updated_at_ms > *deleted_at_ms => {}
                    _ => {
                        highlight_map.insert(
                            id.clone(),
                            HighlightSyncEntry::tombstone(id.clone(), *deleted_at_ms),
                        );
                    }
                }
            }
        }

        Ok(BookSyncState {
            book_hash: book.book_hash.clone(),
            metadata: BookSyncMetadata {
                title: book.title.clone(),
                author: book.author.clone(),
                format: book.format,
                total_pages: book.total_pages,
                description: book.description.clone(),
                tags: book.tags.clone(),
                updated_at_ms: book.updated_at_ms,
            },
            progress: BookSyncProgress {
                current_page: book.current_page,
                percentage: book.percentage,
                page_offset_ratio: book.page_offset_ratio,
                last_read_at_ms: book.last_read_at_ms,
                updated_at_ms: book.updated_at_ms.max(book.last_read_at_ms),
            },
            highlights: highlight_map,
        })
    }

    fn apply_book_sync_state(&mut self, state: &BookSyncState) -> Result<(), String> {
        let metadata = BookMetadata {
            book_hash: state.book_hash.clone(),
            title: state.metadata.title.clone(),
            author: state.metadata.author.clone(),
            format: state.metadata.format,
            current_page: state.progress.current_page,
            total_pages: state.metadata.total_pages,
            percentage: state.progress.percentage,
            description: state.metadata.description.clone(),
            tags: state.metadata.tags.clone(),
            page_offset_ratio: state.progress.page_offset_ratio,
            last_read_at_ms: state.progress.last_read_at_ms,
            updated_at_ms: state
                .metadata
                .updated_at_ms
                .max(state.progress.updated_at_ms),
        };
        self.book_repo.save_book(metadata)?;

        for (id, entry) in &state.highlights {
            if entry.is_deleted() {
                let _ = self.highlight_repo.delete(id);
                self.cursor.record_deleted_highlight(
                    &state.book_hash,
                    id,
                    entry.deleted_at_ms.unwrap_or(entry.updated_at_ms),
                );
            } else if let Some(highlight) = &entry.highlight {
                if self.highlight_repo.find_by_id(id)?.is_some() {
                    self.highlight_repo.update(highlight.clone())?;
                } else {
                    self.highlight_repo.save(highlight.clone())?;
                }
                if let Some(book_tombstones) =
                    self.cursor.deleted_highlights.get_mut(&state.book_hash)
                {
                    book_tombstones.remove(id);
                }
            }
        }

        Ok(())
    }
}
