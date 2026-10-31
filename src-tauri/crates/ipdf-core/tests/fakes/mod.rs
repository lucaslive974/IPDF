#![allow(dead_code)]

use ipdf_core::core::domain::{AnnotationVisitor, BookFormat, BookMetadata, Highlight};
use ipdf_core::core::ports::{
    BookRepository, ExportStrategy, HighlightRepository, PresenceProvider, ReadingActivity,
    StorageEntry, StorageProvider, SyncPayload,
};
use std::collections::BTreeMap;

#[derive(Default)]
pub struct InMemoryBookRepo {
    pub store: BTreeMap<String, BookMetadata>,
}

impl BookRepository for InMemoryBookRepo {
    fn save(&mut self, book: BookMetadata) -> Result<(), String> {
        self.store.insert(book.book_hash.clone(), book);
        Ok(())
    }
    fn find_by_id(&self, book_hash: &str) -> Result<Option<BookMetadata>, String> {
        Ok(self.store.get(book_hash).cloned())
    }
    fn update(&mut self, book: BookMetadata) -> Result<(), String> {
        self.store.insert(book.book_hash.clone(), book);
        Ok(())
    }
    fn delete(&mut self, book_hash: &str) -> Result<(), String> {
        self.store.remove(book_hash);
        Ok(())
    }
    fn find_all(&self) -> Result<Vec<BookMetadata>, String> {
        Ok(self.store.values().cloned().collect())
    }
}

#[derive(Default)]
pub struct InMemoryHighlightRepo {
    pub store: BTreeMap<String, Highlight>,
}

impl HighlightRepository for InMemoryHighlightRepo {
    fn save(&mut self, highlight: Highlight) -> Result<(), String> {
        self.store.insert(highlight.id.clone(), highlight);
        Ok(())
    }
    fn find_by_id(&self, id: &str) -> Result<Option<Highlight>, String> {
        Ok(self.store.get(id).cloned())
    }
    fn update(&mut self, highlight: Highlight) -> Result<(), String> {
        self.store.insert(highlight.id.clone(), highlight);
        Ok(())
    }
    fn delete(&mut self, id: &str) -> Result<(), String> {
        self.store.remove(id);
        Ok(())
    }
    fn find_by_book(&self, book_hash: &str) -> Result<Vec<Highlight>, String> {
        Ok(self
            .store
            .values()
            .filter(|h| h.book_hash == book_hash)
            .cloned()
            .collect())
    }
    fn find_by_book_and_page(
        &self,
        book_hash: &str,
        page_number: u32,
    ) -> Result<Vec<Highlight>, String> {
        Ok(self
            .store
            .values()
            .filter(|h| h.book_hash == book_hash && h.anchor.page_number == page_number)
            .cloned()
            .collect())
    }
}

pub struct InMemoryStorage {
    pub id: String,
    pub available: bool,
    pub binaries: BTreeMap<String, Vec<u8>>,
    pub entries: BTreeMap<String, (StorageEntry, Vec<u8>)>,
    pub read_binary_calls: usize,
}

impl InMemoryStorage {
    pub fn new(id: &str) -> Self {
        Self {
            id: id.to_string(),
            available: true,
            binaries: BTreeMap::new(),
            entries: BTreeMap::new(),
            read_binary_calls: 0,
        }
    }
}

impl StorageProvider for InMemoryStorage {
    fn provider_id(&self) -> &str {
        &self.id
    }
    fn initialize(&mut self) -> Result<bool, String> {
        self.available = true;
        Ok(true)
    }
    fn is_available(&self) -> bool {
        self.available
    }
    fn has_book_binary(&self, book_hash: &str) -> Result<bool, String> {
        Ok(self.binaries.contains_key(book_hash))
    }
    fn read_book_binary(&mut self, book_hash: &str) -> Result<Vec<u8>, String> {
        self.read_binary_calls += 1;
        self.binaries
            .get(book_hash)
            .cloned()
            .ok_or_else(|| format!("Binary not found: {book_hash}"))
    }
    fn write_book_binary(
        &mut self,
        book_hash: &str,
        data: Vec<u8>,
        _format: BookFormat,
    ) -> Result<(), String> {
        self.binaries.insert(book_hash.to_string(), data);
        Ok(())
    }
    fn list_entries(&self, _prefix: Option<&str>) -> Result<Vec<StorageEntry>, String> {
        Ok(self.entries.values().map(|(e, _)| e.clone()).collect())
    }
    fn read_entry(&mut self, name: &str) -> Result<Option<Vec<u8>>, String> {
        Ok(self.entries.get(name).map(|(_, bytes)| bytes.clone()))
    }
    fn write_entry(
        &mut self,
        name: &str,
        data: &[u8],
        mime_type: &str,
    ) -> Result<StorageEntry, String> {
        let entry = StorageEntry {
            name: name.to_string(),
            size_bytes: data.len(),
            mime_type: mime_type.to_string(),
            modified_at_ms: 1000,
        };
        self.entries
            .insert(name.to_string(), (entry.clone(), data.to_vec()));
        Ok(entry)
    }
}

pub struct JsonExport;

impl ExportStrategy for ExportStrategyImpl {
    fn serialize(&self, payload: &SyncPayload) -> Result<Vec<u8>, String> {
        serde_json::to_vec(payload).map_err(|e| e.to_string())
    }
    fn deserialize(&self, raw: &[u8]) -> Result<SyncPayload, String> {
        serde_json::from_slice(raw).map_err(|e| e.to_string())
    }
}

pub type ExportStrategyImpl = JsonExport;

pub struct TestVisitor;

impl AnnotationVisitor<String> for TestVisitor {
    fn visit_assisted_text(&self, raw_data: &str, _updated_at_ms: i64) -> String {
        format!("MD:{raw_data}")
    }
    fn visit_tldraw_board(
        &self,
        _raw_data: &str,
        svg_preview: Option<&str>,
        _updated_at_ms: i64,
    ) -> String {
        format!("TLDRAW:{}", svg_preview.unwrap_or_default())
    }
    fn visit_drawio_diagram(
        &self,
        _raw_data: &str,
        svg_preview: Option<&str>,
        _updated_at_ms: i64,
    ) -> String {
        format!("DRAWIO:{}", svg_preview.unwrap_or_default())
    }
}

pub struct SpyPresence {
    pub id: String,
    pub enabled: bool,
    pub should_fail: bool,
    pub published: Vec<ReadingActivity>,
}

impl PresenceProvider for SpyPresence {
    fn id(&self) -> &str {
        &self.id
    }
    fn is_enabled(&self) -> bool {
        self.enabled
    }
    fn publish_activity(&mut self, activity: &ReadingActivity) -> Result<(), String> {
        if self.should_fail {
            return Err("Simulated IPC error".to_string());
        }
        self.published.push(activity.clone());
        Ok(())
    }
    fn clear_activity(&mut self) -> Result<(), String> {
        self.published.clear();
        Ok(())
    }
}
