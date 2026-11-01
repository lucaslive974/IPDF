mod fakes;

use fakes::FakeDiscordIpcTransport;
use ipdf_core::adapters::presence::{DiscordPresenceAdapter, OP_FRAME, OP_HANDSHAKE};
use ipdf_core::core::ports::{PresenceProvider, ReadingActivity};
use ipdf_core::core::services::RichPresenceManager;

#[test]
fn test_discord_presence_handshake_and_publish_activity() {
    let transport = FakeDiscordIpcTransport::default();
    let mut adapter =
        DiscordPresenceAdapter::new("1234567890", true, transport).with_process_id(9999);

    assert_eq!(adapter.id(), "discord");
    assert!(adapter.is_enabled());

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

    // Verify frames recorded in transport: Handshake (0) and Activity (1)
    let frames = &adapter.transport().sent_frames;
    assert_eq!(frames.len(), 2);
    assert_eq!(frames[0].0, OP_HANDSHAKE);
    assert!(frames[0].1.contains("1234567890"));

    assert_eq!(frames[1].0, OP_FRAME);
    assert!(frames[1]
        .1
        .contains("Crime and Punishment — Fyodor Dostoevsky"));
    assert!(frames[1]
        .1
        .contains("Part 1: Chapter 2 — Pág. 45/350 (12.9%)"));

    // Second publish should not re-handshake
    adapter.publish_activity(&activity).unwrap();
    assert_eq!(adapter.transport().sent_frames.len(), 3);
    assert_eq!(adapter.transport().sent_frames[2].0, OP_FRAME);
}

#[test]
fn test_discord_presence_full_lifecycle_and_formatting() {
    let transport = FakeDiscordIpcTransport::default();
    let mut adapter =
        DiscordPresenceAdapter::new("test_app_id_999", true, transport).with_process_id(4321);

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

    // First publish triggers handshake + frame
    assert!(adapter.publish_activity(&activity).is_ok());

    // Clear activity
    assert!(adapter.clear_activity().is_ok());

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
}

#[test]
fn test_discord_presence_disabled_behavior() {
    let transport = FakeDiscordIpcTransport::default();
    let mut adapter = DiscordPresenceAdapter::new("app_id", false, transport);

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

    // Enable it
    adapter.set_enabled(true);
    assert!(adapter.is_enabled());
    assert!(adapter.publish_activity(&activity).is_ok());

    // Disable it cleans up
    adapter.set_enabled(false);
    assert!(!adapter.is_enabled());
}

#[test]
fn test_discord_presence_error_handling() {
    let transport = FakeDiscordIpcTransport {
        fail_connect: true,
        ..Default::default()
    };

    let mut adapter = DiscordPresenceAdapter::new("app_id", true, transport);
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

    // Should return Err when connect fails
    let err = adapter.publish_activity(&activity);
    assert!(err.is_err());

    // Test send failure
    let transport_send_fail = FakeDiscordIpcTransport {
        fail_send: true,
        ..Default::default()
    };
    let mut adapter_fail = DiscordPresenceAdapter::new("app_id", true, transport_send_fail);
    let send_err = adapter_fail.publish_activity(&activity);
    assert!(send_err.is_err());
}

#[test]
fn test_discord_presence_integrated_with_rich_presence_manager() {
    let transport = FakeDiscordIpcTransport::default();
    let adapter = DiscordPresenceAdapter::new("app_id", true, transport);

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
fn test_native_discord_ipc_transport_and_default_adapter() {
    use ipdf_core::adapters::presence::{
        DiscordIpcTransport, NativeDiscordIpcTransport, NativeDiscordPresenceAdapter, OP_FRAME,
    };
    use std::io::{Read, Write};
    use std::os::unix::net::UnixListener;

    // 1. Default creation
    let default_adapter = NativeDiscordPresenceAdapter::create_default(None, false);
    assert_eq!(default_adapter.id(), "discord");
    assert!(!default_adapter.is_enabled());

    let custom_adapter =
        NativeDiscordPresenceAdapter::create_default(Some("custom_id".into()), true);
    assert!(custom_adapter.is_enabled());

    // 2. Test native unix stream with a local UnixListener
    let temp_socket =
        std::env::temp_dir().join(format!("test_discord_{}.sock", std::process::id()));
    let _ = std::fs::remove_file(&temp_socket);

    let listener = UnixListener::bind(&temp_socket).expect("bind fake unix socket");

    let server_handle = std::thread::spawn(move || {
        if let Ok((mut stream, _)) = listener.accept() {
            let mut header = [0u8; 8];
            if stream.read_exact(&mut header).is_ok() {
                let len = u32::from_le_bytes([header[4], header[5], header[6], header[7]]) as usize;
                let mut buf = vec![0u8; len];
                let _ = stream.read_exact(&mut buf);

                // Reply with 8 bytes header + payload
                let reply_payload = b"{\"ok\":true}";
                let _ = stream.write_all(&OP_FRAME.to_le_bytes());
                let _ = stream.write_all(&(reply_payload.len() as u32).to_le_bytes());
                let _ = stream.write_all(reply_payload);
                let _ = stream.flush();
            }
        }
    });

    let mut transport = NativeDiscordIpcTransport::with_socket_path(&temp_socket);
    assert!(!transport.is_connected());
    assert!(transport.connect().is_ok());
    assert!(transport.is_connected());

    // Connect again is a no-op
    assert!(transport.connect().is_ok());

    let res = transport.send_frame(OP_FRAME, "{\"cmd\":\"TEST\"}");
    assert!(res.is_ok());
    assert!(res.unwrap().contains("ok"));

    transport.disconnect();
    assert!(!transport.is_connected());

    let _ = server_handle.join();
    let _ = std::fs::remove_file(&temp_socket);
}
