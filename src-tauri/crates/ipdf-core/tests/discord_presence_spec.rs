mod fakes;

use fakes::FakeDiscordPresenceClient;
use ipdf_core::adapters::presence::{
    DiscordPresenceAdapter, NativeDiscordPresenceAdapter, DEFAULT_DISCORD_CLIENT_ID,
};
use ipdf_core::core::ports::{PresenceProvider, ReadingActivity};
use ipdf_core::core::services::RichPresenceManager;

#[test]
fn test_discord_presence_start_and_publish_activity() {
    let client = FakeDiscordPresenceClient::default();
    let mut adapter = DiscordPresenceAdapter::new(1234567890, true, client);

    assert_eq!(adapter.id(), "discord");
    assert!(adapter.is_enabled());
    assert_eq!(adapter.client_id(), 1234567890);

    let activity = ReadingActivity {
        book_hash: "hash-dostoievski".to_string(),
        book_title: "Crime and Punishment".to_string(),
        book_author: "Fyodor Dostoevsky".to_string(),
        chapter_title: Some("Part 1: Chapter 2".to_string()),
        current_page: 45,
        total_pages: 350,
        percentage: 12.857,
        state: "reading".to_string(),
        session_started_at_ms: 1_700_000_000_000,
    };

    adapter.publish_activity(&activity).unwrap();

    // Verify client was started
    assert!(adapter.client().started);

    // Verify activity details and state
    let activities = &adapter.client().activities;
    assert_eq!(activities.len(), 1);
    assert_eq!(
        activities[0].details,
        "Crime and Punishment — Fyodor Dostoevsky"
    );
    assert_eq!(
        activities[0].state,
        "Part 1: Chapter 2 — Pág. 45/350 (12.9%)"
    );
    assert_eq!(activities[0].start_time_secs, 1_700_000_000);
    assert_eq!(activities[0].large_image.as_deref(), Some("app_logo"));

    // Second publish should not re-start the client
    adapter.publish_activity(&activity).unwrap();
    assert_eq!(adapter.client().activities.len(), 2);
}

#[test]
fn test_discord_presence_full_lifecycle_and_formatting() {
    let client = FakeDiscordPresenceClient::default();
    let mut adapter = DiscordPresenceAdapter::new(9999, true, client);

    let activity = ReadingActivity {
        book_hash: "hash-clean-code".to_string(),
        book_title: "Clean Code".to_string(),
        book_author: "Robert C. Martin".to_string(),
        chapter_title: Some("Meaningful Names".to_string()),
        current_page: 25,
        total_pages: 400,
        percentage: 6.25,
        state: "reading".to_string(),
        session_started_at_ms: 1_690_000_000_000,
    };

    assert!(adapter.publish_activity(&activity).is_ok());

    // Clear activity
    assert!(adapter.clear_activity().is_ok());
    assert_eq!(adapter.client().clear_calls, 1);

    // Format check without chapter and unknown author
    let activity_no_chapter = ReadingActivity {
        book_hash: "hash-notes".to_string(),
        book_title: "Study Notes".to_string(),
        book_author: "Unknown".to_string(),
        chapter_title: None,
        current_page: 5,
        total_pages: 10,
        percentage: 50.0,
        state: "listening_tts".to_string(),
        session_started_at_ms: 1_690_000_000_000,
    };
    assert!(adapter.publish_activity(&activity_no_chapter).is_ok());

    let activities = &adapter.client().activities;
    assert_eq!(activities.last().unwrap().details, "Study Notes");
    assert_eq!(activities.last().unwrap().state, "Página 5 de 10 (50.0%)");
}

#[test]
fn test_discord_presence_disabled_behavior() {
    let client = FakeDiscordPresenceClient::default();
    let mut adapter = DiscordPresenceAdapter::new(8888, false, client);

    assert!(!adapter.is_enabled());

    let activity = ReadingActivity {
        book_hash: "hash-1".to_string(),
        book_title: "Test".to_string(),
        book_author: "Author".to_string(),
        chapter_title: None,
        current_page: 1,
        total_pages: 100,
        percentage: 1.0,
        state: "reading".to_string(),
        session_started_at_ms: 1000,
    };

    // Publish while disabled should return Ok(()) without action
    assert!(adapter.publish_activity(&activity).is_ok());
    assert_eq!(adapter.client().activities.len(), 0);

    // Enable it
    adapter.set_enabled(true);
    assert!(adapter.is_enabled());
    assert!(adapter.publish_activity(&activity).is_ok());
    assert_eq!(adapter.client().activities.len(), 1);

    // Disable it cleans up
    adapter.set_enabled(false);
    assert!(!adapter.is_enabled());
    assert_eq!(adapter.client().clear_calls, 1);
}

#[test]
fn test_discord_presence_fallback_on_asset_failure() {
    let client = FakeDiscordPresenceClient {
        fail_set: true,
        ..Default::default()
    };

    let mut adapter = DiscordPresenceAdapter::new(7777, true, client);
    let activity = ReadingActivity {
        book_hash: "h".to_string(),
        book_title: "T".to_string(),
        book_author: "A".to_string(),
        chapter_title: None,
        current_page: 1,
        total_pages: 10,
        percentage: 10.0,
        state: "reading".to_string(),
        session_started_at_ms: 1000,
    };

    // Even if initial set_activity fails, publish_activity completes gracefully
    assert!(adapter.publish_activity(&activity).is_ok());
}

#[test]
fn test_discord_presence_integrated_with_rich_presence_manager() {
    let client = FakeDiscordPresenceClient::default();
    let adapter = DiscordPresenceAdapter::new(6666, true, client);

    let mut manager = RichPresenceManager::new(3000);
    manager.register_provider(adapter);

    let activity = ReadingActivity {
        book_hash: "h".to_string(),
        book_title: "Book".to_string(),
        book_author: "Author".to_string(),
        chapter_title: Some("Intro".to_string()),
        current_page: 10,
        total_pages: 100,
        percentage: 10.0,
        state: "annotating".to_string(),
        session_started_at_ms: 1000,
    };

    // First dispatch
    manager.update_activity(&activity, 1000, false);

    // Debounced dispatch (within 3000ms window)
    manager.update_activity(&activity, 2000, false);

    // Immediate dispatch bypasses debounce
    manager.update_activity(&activity, 2500, true);

    // Set provider enabled toggle via manager
    manager.set_provider_enabled("discord", false);
    manager.set_provider_enabled("discord", true);

    // Clear all presence
    manager.clear_all_presence();
}

#[test]
fn test_native_discord_presence_adapter_creation() {
    let default_adapter = NativeDiscordPresenceAdapter::create_default(None, false);
    assert_eq!(default_adapter.id(), "discord");
    assert_eq!(default_adapter.client_id(), DEFAULT_DISCORD_CLIENT_ID);
    assert!(!default_adapter.is_enabled());

    let custom_adapter = NativeDiscordPresenceAdapter::create_default(Some(12345), true);
    assert_eq!(custom_adapter.client_id(), 12345);
    assert!(custom_adapter.is_enabled());
}
