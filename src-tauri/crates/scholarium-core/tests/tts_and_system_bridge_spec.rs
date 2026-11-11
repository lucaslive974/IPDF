mod fakes;

use fakes::{SpyMediaControls, SpyPowerBlocker, SpyTtsProvider};
use scholarium_core::core::ports::{MediaMetadata, PlaybackState, SpeakOptions};
use scholarium_core::core::services::{SentenceQueueItem, TtsSessionManager};

#[test]
fn test_tts_session_coordinates_prefetch_media_controls_and_wake_lock() {
    let tts = SpyTtsProvider::default();
    let media = SpyMediaControls::default();
    let power = SpyPowerBlocker::default();

    let mut session = TtsSessionManager::new(tts, media, power, SpeakOptions::default());

    let metadata = MediaMetadata {
        book_title: "Critique of Pure Reason".to_string(),
        author: "Immanuel Kant".to_string(),
        chapter: Some("Transcendental Aesthetic".to_string()),
        cover_bytes: None,
    };

    let sentences = vec![
        SentenceQueueItem {
            id: "s-1".to_string(),
            text: "There can be no doubt that all our knowledge begins with experience.".to_string(),
        },
        SentenceQueueItem {
            id: "s-2".to_string(),
            text: "But though all our knowledge begins with experience, it does not follow that it all arises out of experience.".to_string(),
        },
    ];

    let first = session
        .start_session(&metadata, sentences)
        .unwrap()
        .expect("should return first sentence");
    assert_eq!(first.id, "s-1");
    assert_eq!(session.playback_state(), PlaybackState::Playing);

    session.pause().unwrap();
    assert_eq!(session.playback_state(), PlaybackState::Paused);

    session.resume().unwrap();
    assert_eq!(session.playback_state(), PlaybackState::Playing);

    let second = session
        .advance_to_next()
        .unwrap()
        .expect("should return second sentence");
    assert_eq!(second.id, "s-2");

    let ended = session.advance_to_next().unwrap();
    assert!(ended.is_none());
    assert_eq!(session.playback_state(), PlaybackState::None);
}
