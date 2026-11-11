mod fakes;

use fakes::{InMemoryStorage, SpyPresence};
use scholarium_core::adapters::storage::CachedStorageDecorator;
use scholarium_core::core::domain::BookFormat;
use scholarium_core::core::ports::{ReadingActivity, ReadingContext, StorageProvider};
use scholarium_core::core::services::{PromptBuilder, RichPresenceManager};

#[test]
fn test_cached_storage_decorator_and_presence_debounce() {
    let local_cache = InMemoryStorage::new("local-cache");
    let mut remote = InMemoryStorage::new("google-drive");
    remote
        .write_book_binary("hash-1", vec![1, 2, 3, 4], BookFormat::Epub)
        .unwrap();
    remote
        .write_entry("index.json", b"{\"ok\":true}", "application/json")
        .unwrap();

    let mut decorated = CachedStorageDecorator::new(local_cache, remote, BookFormat::Epub);
    assert_eq!(decorated.provider_id(), "cached:google-drive");
    assert!(decorated.initialize().unwrap());
    assert!(decorated.is_available());
    assert!(decorated.has_book_binary("hash-1").unwrap());

    let bytes = decorated.read_book_binary("hash-1").unwrap();
    assert_eq!(bytes, vec![1, 2, 3, 4]);
    assert!(decorated.has_book_binary("hash-1").unwrap());
    assert_eq!(
        decorated.read_book_binary("hash-1").unwrap(),
        vec![1, 2, 3, 4]
    );

    decorated
        .write_book_binary("hash-2", vec![9, 9], BookFormat::Pdf)
        .unwrap();
    assert_eq!(decorated.list_entries(None).unwrap().len(), 3);

    let entry_bytes = decorated.read_entry("index.json").unwrap().unwrap();
    assert_eq!(entry_bytes, b"{\"ok\":true}");

    decorated
        .write_entry("notes.json", b"[]", "application/json")
        .unwrap();

    // Test rename_entry through CachedStorageDecorator
    decorated
        .rename_entry("notes.json", "renamed_notes.json")
        .unwrap();
    assert_eq!(
        decorated.read_entry("renamed_notes.json").unwrap().unwrap(),
        b"[]"
    );
    assert!(decorated.rename_entry("missing.json", "new.json").is_err());

    let mut presence = RichPresenceManager::new(3000);
    presence.register_provider(SpyPresence {
        id: "failing".to_string(),
        enabled: true,
        should_fail: true,
        published: vec![],
    });
    presence.register_provider(SpyPresence {
        id: "healthy".to_string(),
        enabled: true,
        should_fail: false,
        published: vec![],
    });

    let activity = ReadingActivity {
        book_hash: "hash-1".to_string(),
        book_title: "Republic".to_string(),
        book_author: "Plato".to_string(),
        chapter_title: Some("Book VII".to_string()),
        current_page: 1,
        total_pages: 300,
        percentage: 0.3,
        state: "reading".to_string(),
        session_started_at_ms: 1000,
    };

    presence.update_reading_activity(&activity, 1000, false);
    presence.update_reading_activity(&activity, 2000, false);
    presence.update_reading_activity(&activity, 2500, true);
    presence.clear_all_presence();

    let ctx = ReadingContext {
        book_title: "Republic".to_string(),
        book_author: "Plato".to_string(),
        chapter_title: Some("Book VII".to_string()),
        selected_text: "noesis".to_string(),
        surrounding_context: "The soul uses noesis.".to_string(),
    };
    let lookup_prompt = PromptBuilder::build_term_lookup_request(&ctx, "en");
    assert!(lookup_prompt.user_prompt.contains("Plato"));

    let translation_prompt = PromptBuilder::build_translation_request(&ctx, "pt-BR");
    assert!(translation_prompt.user_prompt.contains("pt-BR"));
}
