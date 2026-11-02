mod fakes;

use fakes::FakeDiscordPresenceClient;
use ipdf_core::adapters::presence::{
    DiscordPresenceAdapter, NativeDiscordPresenceAdapter, DEFAULT_DISCORD_CLIENT_ID,
};
use ipdf_core::core::ports::{PresenceActivity, PresenceProvider, ReadingActivity};
use ipdf_core::core::services::RichPresenceManager;

#[test]
fn test_discord_presence_start_and_publish_reading_activity() {
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

    adapter
        .publish_activity(&PresenceActivity::Reading(activity.clone()))
        .unwrap();

    // Verify client was started
    assert!(adapter.client().started);

    // Verify activity details and state (in English)
    let activities = &adapter.client().activities;
    assert_eq!(activities.len(), 1);
    assert_eq!(
        activities[0].details,
        "Crime and Punishment — Fyodor Dostoevsky"
    );
    assert_eq!(
        activities[0].state,
        "Part 1: Chapter 2 — Page 45 of 350 (12.9%)"
    );
    assert_eq!(activities[0].start_time_secs, 1_700_000_000);
    assert_eq!(activities[0].large_image.as_deref(), Some("app_logo"));
    assert_eq!(
        activities[0].large_text.as_deref(),
        Some("Scholarium — Active Study Reader")
    );

    // Second publish should not re-start the client
    adapter
        .publish_activity(&PresenceActivity::Reading(activity))
        .unwrap();
    assert_eq!(adapter.client().activities.len(), 2);
}

#[test]
fn test_discord_presence_library_and_annotations_formatting() {
    let client = FakeDiscordPresenceClient::default();
    let mut adapter = DiscordPresenceAdapter::new(9999, true, client);

    // 1. Library with multiple books
    let library_activity = PresenceActivity::Library {
        total_books: 12,
        session_started_at_ms: 1_700_000_000_000,
    };
    adapter.publish_activity(&library_activity).unwrap();

    let activities = &adapter.client().activities;
    assert_eq!(activities.len(), 1);
    assert_eq!(activities[0].details, "Browsing Library");
    assert_eq!(activities[0].state, "12 books in collection");
    assert_eq!(
        activities[0].large_text.as_deref(),
        Some("Scholarium — Library")
    );

    // 2. Library with single book
    let single_book = PresenceActivity::Library {
        total_books: 1,
        session_started_at_ms: 0,
    };
    adapter.publish_activity(&single_book).unwrap();
    assert_eq!(
        adapter.client().activities.last().unwrap().state,
        "1 book in collection"
    );

    // 3. Annotations with multiple notes
    let notes_activity = PresenceActivity::Annotations {
        total_annotations: 42,
        session_started_at_ms: 1_700_000_000_000,
    };
    adapter.publish_activity(&notes_activity).unwrap();
    assert_eq!(
        adapter.client().activities.last().unwrap().details,
        "Reviewing Annotations"
    );
    assert_eq!(
        adapter.client().activities.last().unwrap().state,
        "42 notes taken"
    );
    assert_eq!(
        adapter
            .client()
            .activities
            .last()
            .unwrap()
            .large_text
            .as_deref(),
        Some("Scholarium — Annotations")
    );

    // 4. Annotations with single note
    let single_note = PresenceActivity::Annotations {
        total_annotations: 1,
        session_started_at_ms: 0,
    };
    adapter.publish_activity(&single_note).unwrap();
    assert_eq!(
        adapter.client().activities.last().unwrap().state,
        "1 note taken"
    );
}

#[test]
fn test_discord_presence_healthcheck() {
    let client = FakeDiscordPresenceClient {
        healthy: true,
        ..Default::default()
    };

    let mut adapter = DiscordPresenceAdapter::new(8888, true, client);

    // Enabled and healthy
    let health = adapter.check_health().unwrap();
    assert!(health.ok);
    assert_eq!(health.message, "Connected to Discord client");

    // Client reports unhealthy (Discord closed/not detected)
    adapter.client_mut().healthy = false;
    let health = adapter.check_health().unwrap();
    assert!(!health.ok);
    assert!(health.message.contains("not running or not detected"));

    // Disabled in settings
    adapter.set_enabled(false);
    let health = adapter.check_health().unwrap();
    assert!(!health.ok);
    assert!(health.message.contains("disabled in settings"));
}

#[test]
fn test_discord_presence_disabled_behavior() {
    let client = FakeDiscordPresenceClient::default();
    let mut adapter = DiscordPresenceAdapter::new(8888, false, client);

    assert!(!adapter.is_enabled());

    let activity = PresenceActivity::Library {
        total_books: 5,
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
    let activity = PresenceActivity::Library {
        total_books: 1,
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

    let reading = ReadingActivity {
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

    // Reading dispatch with debounce
    manager.update_reading_activity(&reading, 1000, false);
    manager.update_reading_activity(&reading, 2000, false);
    manager.update_reading_activity(&reading, 2500, true);

    // Library dispatch
    let library_act = PresenceActivity::Library {
        total_books: 10,
        session_started_at_ms: 3000,
    };
    manager.update_activity(&library_act, 3000, true);

    // Healthcheck through manager
    let health = manager.check_provider_health("discord").unwrap();
    assert!(health.ok);

    // Set provider enabled toggle via manager
    manager.set_provider_enabled("discord", false);
    assert!(!manager.is_provider_enabled("discord"));
    manager.set_provider_enabled("discord", true);
    assert!(manager.is_provider_enabled("discord"));

    // Clear all presence
    manager.clear_all_presence();

    // Check unknown provider health
    assert!(manager.check_provider_health("unknown").is_err());
}

#[test]
fn test_rich_presence_global_monotonic_timer_and_context_bypass() {
    let recorded = std::sync::Arc::new(std::sync::Mutex::new(Vec::new()));
    let client = FakeDiscordPresenceClient {
        shared_activities: Some(std::sync::Arc::clone(&recorded)),
        ..Default::default()
    };
    let adapter = DiscordPresenceAdapter::new(5555, true, client);

    let app_start = 1_700_000_000_000;
    let mut manager = RichPresenceManager::new_with_start_time(3000, app_start);
    assert_eq!(manager.app_started_at_ms(), app_start);
    manager.register_provider(adapter);

    // 1. In Library at T = +10s
    let lib_activity = PresenceActivity::Library {
        total_books: 5,
        session_started_at_ms: 1_700_000_010_000,
    };
    manager.update_activity(&lib_activity, 1_700_000_010_000, false);

    // 2. User opens Book A at T = +11s (< 3000ms after library, must bypass debounce!)
    let reading_book_a = ReadingActivity {
        book_hash: "hash-book-a".to_string(),
        book_title: "Book A".to_string(),
        book_author: "Author A".to_string(),
        chapter_title: None,
        current_page: 1,
        total_pages: 100,
        percentage: 1.0,
        state: "reading".to_string(),
        session_started_at_ms: 1_700_000_011_000,
    };
    manager.update_reading_activity(&reading_book_a, 1_700_000_011_000, false);

    // 3. Page turn on Book A at T = +12s (same book, < 3000ms -> should be debounced)
    let mut page_2 = reading_book_a.clone();
    page_2.current_page = 2;
    manager.update_reading_activity(&page_2, 1_700_000_012_000, false);

    // 4. Page turn on Book A at T = +15s (same book, >= 3000ms -> dispatched)
    let mut page_3 = reading_book_a;
    page_3.current_page = 3;
    manager.update_reading_activity(&page_3, 1_700_000_015_000, false);

    // 5. User switches to Annotations at T = +16s (context change -> bypasses debounce!)
    let annot_activity = PresenceActivity::Annotations {
        total_annotations: 20,
        session_started_at_ms: 1_700_000_016_000,
    };
    manager.update_activity(&annot_activity, 1_700_000_016_000, false);

    // Verify all activities have the EXACT same start timestamp (1_700_000_000s)
    let expected_start_secs = app_start / 1000;
    let list = recorded.lock().unwrap();
    // Exactly 4 dispatched activities: Library (1), Book A open (2), Book A page 3 (4), Annotations (5).
    // Page 2 was debounced.
    assert_eq!(list.len(), 4);

    assert_eq!(list[0].details, "Browsing Library");
    assert_eq!(list[0].start_time_secs, expected_start_secs);

    assert_eq!(list[1].details, "Book A — Author A");
    assert_eq!(list[1].state, "Page 1 of 100 (1.0%)");
    assert_eq!(list[1].start_time_secs, expected_start_secs);

    assert_eq!(list[2].details, "Book A — Author A");
    assert_eq!(list[2].state, "Page 3 of 100 (1.0%)");
    assert_eq!(list[2].start_time_secs, expected_start_secs);

    assert_eq!(list[3].details, "Reviewing Annotations");
    assert_eq!(list[3].start_time_secs, expected_start_secs);
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
