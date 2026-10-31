mod fakes;

use fakes::{InMemoryStorage, SpyPresence};
use ipdf_core::adapters::storage::CachedStorageDecorator;
use ipdf_core::core::domain::BookFormat;
use ipdf_core::core::ports::{ReadingActivity, ReadingContext, StorageProvider};
use ipdf_core::core::services::{PromptBuilder, RichPresenceManager};

#[test]
fn test_cached_storage_decorator_and_presence_debounce() {
    let local_cache = InMemoryStorage::new("local-cache");
    let mut remote = InMemoryStorage::new("google-drive");
    remote
        .write_book_binary("hash-1", vec![1, 2, 3, 4], BookFormat::Epub)
        .unwrap();

    let mut decorated = CachedStorageDecorator::new(local_cache, remote, BookFormat::Epub);
    assert!(decorated.has_book_binary("hash-1").unwrap());

    let bytes = decorated.read_book_binary("hash-1").unwrap();
    assert_eq!(bytes, vec![1, 2, 3, 4]);

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

    presence.update_activity(&activity, 1000, false);
    presence.update_activity(&activity, 2000, false);

    let prompt = PromptBuilder::build_term_lookup_request(
        &ReadingContext {
            book_title: "Republic".to_string(),
            book_author: "Plato".to_string(),
            chapter_title: Some("Book VII".to_string()),
            selected_text: "noesis".to_string(),
            surrounding_context: "The soul uses noesis.".to_string(),
        },
        "en",
    );
    assert!(prompt.user_prompt.contains("Plato"));
}
