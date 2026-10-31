use crate::domain::{BookFormat, Highlight, HighlightAnchor};
use crate::ports::{
    BookRepository, ConflictResolution, ExportOptions, ExportStrategy, HighlightRepository,
    ImportReport, LlmRequest, PresenceProvider, ReadingActivity, ReadingContext, StorageEntry,
    StorageProvider, SyncPayload,
};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, BTreeSet};
use std::io::Read;

pub struct CreateHighlightInput {
    pub id: String,
    pub book_hash: String,
    pub text: String,
    pub color: String,
    pub anchor: HighlightAnchor,
    pub note: String,
    pub timestamp_ms: i64,
}

pub struct Sha256BookHasher;

impl Sha256BookHasher {
    pub fn hash_stream<R: Read>(mut reader: R) -> Result<String, String> {
        let mut hasher = Sha256::new();
        let mut buffer = [0u8; 64 * 1024];
        loop {
            let bytes_read = reader.read(&mut buffer).map_err(|e| e.to_string())?;
            if bytes_read == 0 {
                break;
            }
            hasher.update(&buffer[..bytes_read]);
        }
        let digest = hasher.finalize();
        Ok(digest.iter().map(|b| format!("{b:02x}")).collect())
    }
}

pub struct HighlightManager<R: HighlightRepository> {
    repository: R,
    cache: BTreeMap<String, Highlight>,
}

impl<R: HighlightRepository> HighlightManager<R> {
    pub fn new(repository: R) -> Self {
        Self {
            repository,
            cache: BTreeMap::new(),
        }
    }

    pub fn load_book_highlights(&mut self, book_hash: &str) -> Result<Vec<Highlight>, String> {
        self.cache.clear();
        let highlights = self.repository.find_by_book(book_hash)?;
        for hl in &highlights {
            self.cache.insert(hl.id.clone(), hl.clone());
        }
        Ok(highlights)
    }

    pub fn create_highlight(&mut self, input: CreateHighlightInput) -> Result<Highlight, String> {
        let hl = Highlight::new(
            input.id,
            input.book_hash,
            input.text,
            input.color,
            input.anchor,
            input.note,
            input.timestamp_ms,
        );
        self.repository.save(hl.clone())?;
        self.cache.insert(hl.id.clone(), hl.clone());
        Ok(hl)
    }

    pub fn get_for_page(&self, page_number: u32) -> Vec<Highlight> {
        self.cache
            .values()
            .filter(|h| h.anchor.page_number == page_number)
            .cloned()
            .collect()
    }

    pub fn repository_mut(&mut self) -> &mut R {
        &mut self.repository
    }
}

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

pub struct CloudlessSyncEngine {
    portability: DataPortabilityService,
}

impl CloudlessSyncEngine {
    pub const LIBRARY_INDEX_FILE: &'static str = ".reader_library_index.json";

    pub fn new(portability: DataPortabilityService) -> Self {
        Self { portability }
    }

    pub fn sync_book_state<B, H, S, E>(
        &self,
        book_hash: &str,
        book_repo: &mut B,
        highlight_repo: &mut H,
        storage: &mut S,
        strategy: &E,
        now_ms: i64,
    ) -> Result<(), String>
    where
        B: BookRepository,
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
                book_repo,
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
        let merged =
            self.portability
                .export_data(book_repo, highlight_repo, storage, &options, strategy)?;

        storage.write_entry(&file_name, &merged, "application/json")?;
        Ok(())
    }

    pub fn sync_library_index<B, H, S, E>(
        &self,
        book_repo: &mut B,
        highlight_repo: &mut H,
        storage: &mut S,
        strategy: &E,
        now_ms: i64,
    ) -> Result<(), String>
    where
        B: BookRepository,
        H: HighlightRepository,
        S: StorageProvider,
        E: ExportStrategy,
    {
        if !storage.is_available() {
            return Ok(());
        }

        if let Some(existing_bytes) = storage.read_entry(Self::LIBRARY_INDEX_FILE)? {
            self.portability.import_data(
                book_repo,
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
        let updated =
            self.portability
                .export_data(book_repo, highlight_repo, storage, &options, strategy)?;

        storage.write_entry(Self::LIBRARY_INDEX_FILE, &updated, "application/json")?;
        Ok(())
    }
}

pub struct CachedStorageDecorator<L: StorageProvider, P: StorageProvider> {
    provider_id: String,
    local_cache: L,
    primary_storage: P,
    default_format: BookFormat,
}

impl<L: StorageProvider, P: StorageProvider> CachedStorageDecorator<L, P> {
    pub fn new(local_cache: L, primary_storage: P, default_format: BookFormat) -> Self {
        let provider_id = format!("cached:{}", primary_storage.provider_id());
        Self {
            provider_id,
            local_cache,
            primary_storage,
            default_format,
        }
    }
}

impl<L: StorageProvider, P: StorageProvider> StorageProvider for CachedStorageDecorator<L, P> {
    fn provider_id(&self) -> &str {
        &self.provider_id
    }

    fn initialize(&mut self) -> Result<bool, String> {
        self.local_cache.initialize()?;
        self.primary_storage.initialize()
    }

    fn is_available(&self) -> bool {
        self.primary_storage.is_available() || self.local_cache.is_available()
    }

    fn has_book_binary(&self, book_hash: &str) -> Result<bool, String> {
        if self.local_cache.has_book_binary(book_hash)? {
            return Ok(true);
        }
        if self.primary_storage.is_available() {
            return self.primary_storage.has_book_binary(book_hash);
        }
        Ok(false)
    }

    fn read_book_binary(&mut self, book_hash: &str) -> Result<Vec<u8>, String> {
        if self.local_cache.has_book_binary(book_hash)? {
            return self.local_cache.read_book_binary(book_hash);
        }
        let bytes = self.primary_storage.read_book_binary(book_hash)?;
        self.local_cache
            .write_book_binary(book_hash, bytes.clone(), self.default_format)?;
        Ok(bytes)
    }

    fn write_book_binary(
        &mut self,
        book_hash: &str,
        data: Vec<u8>,
        format: BookFormat,
    ) -> Result<(), String> {
        self.local_cache
            .write_book_binary(book_hash, data.clone(), format)?;
        if self.primary_storage.is_available() {
            self.primary_storage
                .write_book_binary(book_hash, data, format)?;
        }
        Ok(())
    }

    fn list_entries(&self, prefix: Option<&str>) -> Result<Vec<StorageEntry>, String> {
        if self.primary_storage.is_available() {
            return self.primary_storage.list_entries(prefix);
        }
        self.local_cache.list_entries(prefix)
    }

    fn read_entry(&mut self, name: &str) -> Result<Option<Vec<u8>>, String> {
        if self.primary_storage.is_available() {
            if let Some(bytes) = self.primary_storage.read_entry(name)? {
                self.local_cache
                    .write_entry(name, &bytes, "application/octet-stream")?;
                return Ok(Some(bytes));
            }
        }
        self.local_cache.read_entry(name)
    }

    fn write_entry(
        &mut self,
        name: &str,
        data: &[u8],
        mime_type: &str,
    ) -> Result<StorageEntry, String> {
        let local_res = self.local_cache.write_entry(name, data, mime_type)?;
        if self.primary_storage.is_available() {
            return self.primary_storage.write_entry(name, data, mime_type);
        }
        Ok(local_res)
    }
}

pub struct PromptBuilder;

impl PromptBuilder {
    pub fn build_term_lookup_request(ctx: &ReadingContext, target_lang: &str) -> LlmRequest {
        LlmRequest {
            system_instruction:
                "You are a philosophical and literary lexicon assistant. Provide accurate contextual definitions."
                    .to_string(),
            user_prompt: Self::format_context_block(
                ctx,
                &format!(
                    "Define the selected term \"{}\" in {target_lang} within this specific work's context.",
                    ctx.selected_text
                ),
            ),
            temperature: 0.2,
        }
    }

    pub fn build_translation_request(ctx: &ReadingContext, target_lang: &str) -> LlmRequest {
        LlmRequest {
            system_instruction:
                "You are a literary and philosophical translator. Preserve nuance and terminology."
                    .to_string(),
            user_prompt: Self::format_context_block(
                ctx,
                &format!(
                    "Translate the selected passage into {target_lang}, preserving philosophical precision."
                ),
            ),
            temperature: 0.2,
        }
    }

    fn format_context_block(ctx: &ReadingContext, directive: &str) -> String {
        let mut lines = vec![
            format!("Book Title: {}", ctx.book_title),
            format!("Author: {}", ctx.book_author),
        ];
        if let Some(ref chapter) = ctx.chapter_title {
            lines.push(format!("Chapter: {chapter}"));
        }
        lines.push(format!(
            "Surrounding Paragraph: \"{}\"",
            ctx.surrounding_context
        ));
        lines.push(format!("Selected Text: \"{}\"", ctx.selected_text));
        lines.push(format!("Task: {directive}"));
        lines.join("\n")
    }
}

pub struct RichPresenceManager<P: PresenceProvider> {
    providers: Vec<P>,
    debounce_ms: i64,
    last_dispatched_at_ms: Option<i64>,
}

impl<P: PresenceProvider> RichPresenceManager<P> {
    pub fn new(debounce_ms: i64) -> Self {
        Self {
            providers: Vec::new(),
            debounce_ms,
            last_dispatched_at_ms: None,
        }
    }

    pub fn register_provider(&mut self, provider: P) {
        self.providers.push(provider);
    }

    pub fn update_activity(&mut self, activity: &ReadingActivity, now_ms: i64, immediate: bool) {
        if !immediate {
            if let Some(last_ms) = self.last_dispatched_at_ms {
                if now_ms - last_ms < self.debounce_ms {
                    return;
                }
            }
        }
        self.last_dispatched_at_ms = Some(now_ms);
        for provider in &mut self.providers {
            if provider.is_enabled() {
                let _ = provider.publish_activity(activity);
            }
        }
    }

    pub fn clear_all_presence(&mut self) {
        for provider in &mut self.providers {
            if provider.is_enabled() {
                let _ = provider.clear_activity();
            }
        }
    }
}
