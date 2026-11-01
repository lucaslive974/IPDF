#![allow(dead_code)]

use ipdf_core::core::domain::{BookFormat, Highlight};
use ipdf_core::core::ports::{
    ExportStrategy, HighlightRepository, MediaControlService, MediaMetadata, PlaybackState,
    PowerSaveBlocker, PresenceProvider, ReadingActivity, SpeakOptions, StorageEntry,
    StorageProvider, SyncPayload, TtsProvider,
};
use std::collections::BTreeMap;

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
    fn delete_by_book(&mut self, book_hash: &str) -> Result<usize, String> {
        let initial_len = self.store.len();
        self.store.retain(|_, h| h.book_hash != book_hash);
        Ok(initial_len - self.store.len())
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
    fn find_all(&self) -> Result<Vec<Highlight>, String> {
        let mut list: Vec<Highlight> = self.store.values().cloned().collect();
        list.sort_by(|a, b| b.updated_at_ms.cmp(&a.updated_at_ms));
        Ok(list)
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
        format: BookFormat,
    ) -> Result<(), String> {
        let ext = match format {
            BookFormat::Epub => "epub",
            BookFormat::Pdf => "pdf",
        };
        let file_name = format!("{book_hash}.{ext}");
        let mime_type = match format {
            BookFormat::Epub => "application/epub+zip",
            BookFormat::Pdf => "application/pdf",
        };
        let _ = self.write_entry(&file_name, &data, mime_type)?;
        self.binaries.insert(book_hash.to_string(), data);
        Ok(())
    }
    fn delete_book_binary(&mut self, book_hash: &str) -> Result<bool, String> {
        let existed = self.binaries.remove(book_hash).is_some();
        let epub_name = format!("{book_hash}.epub");
        let pdf_name = format!("{book_hash}.pdf");
        self.entries.remove(&epub_name);
        self.entries.remove(&pdf_name);
        Ok(existed)
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
    fn rename_entry(&mut self, old_name: &str, new_name: &str) -> Result<(), String> {
        let (mut entry, data) = self
            .entries
            .remove(old_name)
            .ok_or_else(|| format!("Entry not found: {old_name}"))?;
        entry.name = new_name.to_string();
        self.entries.insert(new_name.to_string(), (entry, data));
        Ok(())
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
    fn set_enabled(&mut self, enabled: bool) {
        self.enabled = enabled;
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

#[derive(Default)]
pub struct SpyTtsProvider {
    pub initialized: bool,
    pub spoken_ids: Vec<String>,
    pub prefetched_ids: Vec<String>,
    pub paused: bool,
    pub stopped: bool,
}

impl TtsProvider for SpyTtsProvider {
    fn initialize(&mut self) -> Result<(), String> {
        self.initialized = true;
        Ok(())
    }
    fn speak(
        &mut self,
        sentence_id: &str,
        _text: &str,
        _options: &SpeakOptions,
    ) -> Result<(), String> {
        self.spoken_ids.push(sentence_id.to_string());
        Ok(())
    }
    fn prefetch(
        &mut self,
        sentence_id: &str,
        _text: &str,
        _options: &SpeakOptions,
    ) -> Result<(), String> {
        self.prefetched_ids.push(sentence_id.to_string());
        Ok(())
    }
    fn pause(&mut self) -> Result<(), String> {
        self.paused = true;
        Ok(())
    }
    fn resume(&mut self) -> Result<(), String> {
        self.paused = false;
        Ok(())
    }
    fn stop(&mut self) -> Result<(), String> {
        self.stopped = true;
        Ok(())
    }
}

#[derive(Default)]
pub struct SpyMediaControls {
    pub last_metadata: Option<MediaMetadata>,
    pub states: Vec<PlaybackState>,
}

impl MediaControlService for SpyMediaControls {
    fn set_metadata(&mut self, metadata: &MediaMetadata) -> Result<(), String> {
        self.last_metadata = Some(metadata.clone());
        Ok(())
    }
    fn set_playback_state(&mut self, state: PlaybackState) -> Result<(), String> {
        self.states.push(state);
        Ok(())
    }
}

#[derive(Default)]
pub struct SpyPowerBlocker {
    pub awake_history: Vec<bool>,
}

impl PowerSaveBlocker for SpyPowerBlocker {
    fn keep_screen_awake(&mut self, enable: bool) -> Result<(), String> {
        self.awake_history.push(enable);
        Ok(())
    }
}

#[derive(Default)]
pub struct FakeDiscordIpcTransport {
    pub connected: bool,
    pub fail_connect: bool,
    pub fail_send: bool,
    pub sent_frames: Vec<(u32, String)>,
}

impl ipdf_core::adapters::presence::DiscordIpcTransport for FakeDiscordIpcTransport {
    fn is_connected(&self) -> bool {
        self.connected
    }

    fn connect(&mut self) -> Result<(), String> {
        if self.fail_connect {
            return Err("Fake Discord connection failed".to_string());
        }
        self.connected = true;
        Ok(())
    }

    fn send_frame(&mut self, opcode: u32, payload: &str) -> Result<String, String> {
        if !self.connected {
            return Err("Not connected".to_string());
        }
        if self.fail_send {
            return Err("Fake frame send failed".to_string());
        }
        self.sent_frames.push((opcode, payload.to_string()));
        Ok(r#"{"cmd":"SET_ACTIVITY","data":{},"evt":null,"nonce":"1"}"#.to_string())
    }

    fn disconnect(&mut self) {
        self.connected = false;
    }
}
