use scholarium_core::core::domain::{
    BookAvailability, BookFormat, BookSyncMetadata, BookSyncProgress, BookSyncState, Highlight,
    HighlightAnchor, HighlightSyncEntry, ManifestBookEntry, PlatformKind, SyncManifest, SyncReport,
};
use scholarium_core::core::ports::{
    AuthToken, CloudAuthKind, CloudProviderDescriptor, CloudSession, CloudStorageError,
};
use std::collections::BTreeMap;

fn sample_highlight(id: &str, updated_at_ms: i64) -> Highlight {
    Highlight::new(
        id,
        "book-hash-1",
        "Know thyself",
        "#FDE047",
        HighlightAnchor {
            format: BookFormat::Epub,
            page_number: 12,
            epub_cfi: Some("epubcfi(/6/4!/4/2)".to_string()),
            pdf_rects: None,
        },
        "Socratic note",
        updated_at_ms,
    )
}

#[test]
fn sync_manifest_and_book_state_hashes_are_deterministic() {
    let manifest = SyncManifest::new_empty(1_000);
    assert_eq!(
        manifest.schema_version,
        SyncManifest::CURRENT_SCHEMA_VERSION
    );
    assert_eq!(manifest.revision, 0);
    assert!(manifest.books.is_empty());

    let entry = ManifestBookEntry {
        state_hash: "abc".to_string(),
        format: BookFormat::Epub,
        cover_mime_type: Some("image/jpeg".to_string()),
        file_size_bytes: Some(1024),
        updated_at_ms: 1_000,
        deleted_at_ms: None,
    };
    assert!(!entry.is_deleted());

    let deleted_entry = ManifestBookEntry {
        deleted_at_ms: Some(2_000),
        ..entry.clone()
    };
    assert!(deleted_entry.is_deleted());

    let mut highlights_a = BTreeMap::new();
    highlights_a.insert(
        "h1".to_string(),
        HighlightSyncEntry::active(sample_highlight("h1", 100)),
    );
    highlights_a.insert("h2".to_string(), HighlightSyncEntry::tombstone("h2", 200));

    let mut highlights_b = BTreeMap::new();
    highlights_b.insert("h2".to_string(), HighlightSyncEntry::tombstone("h2", 200));
    highlights_b.insert(
        "h1".to_string(),
        HighlightSyncEntry::active(sample_highlight("h1", 100)),
    );

    let state_a = BookSyncState {
        book_hash: "book-hash-1".to_string(),
        metadata: BookSyncMetadata {
            title: "Apology".to_string(),
            author: "Plato".to_string(),
            format: BookFormat::Epub,
            total_pages: 48,
            description: Some("Defense of Socrates".to_string()),
            tags: vec!["philosophy".to_string()],
            updated_at_ms: 500,
        },
        progress: BookSyncProgress {
            current_page: 12,
            percentage: 25.0,
            page_offset_ratio: 0.2,
            last_read_at_ms: 600,
            updated_at_ms: 600,
        },
        highlights: highlights_a,
    };

    let state_b = BookSyncState {
        highlights: highlights_b,
        ..state_a.clone()
    };

    assert!(!state_a.highlights["h1"].is_deleted());
    assert!(state_a.highlights["h2"].is_deleted());

    let hash_a = state_a.compute_state_hash().unwrap();
    let hash_b = state_b.compute_state_hash().unwrap();
    assert_eq!(hash_a, hash_b);
    assert_eq!(hash_a.len(), 64);

    assert_eq!(BookAvailability::default(), BookAvailability::Local);
    let report = SyncReport::default();
    assert_eq!(report.revision, 0);
}

#[test]
fn cloud_auth_descriptor_token_expiry_and_storage_errors_behave_correctly() {
    const ALL_PLATFORMS: &[PlatformKind] = &[
        PlatformKind::Linux,
        PlatformKind::Windows,
        PlatformKind::Android,
        PlatformKind::Ios,
    ];
    let gdrive = CloudProviderDescriptor {
        id: "google_drive",
        display_name: "Google Drive",
        auth_kind: CloudAuthKind::OAuthPkce,
        supported_platforms: ALL_PLATFORMS,
    };
    assert!(gdrive.supports_platform(PlatformKind::Linux));
    assert!(gdrive.supports_platform(PlatformKind::Android));

    const APPLE_ONLY: &[PlatformKind] = &[PlatformKind::Ios];
    let icloud = CloudProviderDescriptor {
        id: "icloud_drive",
        display_name: "iCloud Drive",
        auth_kind: CloudAuthKind::NativeSystem,
        supported_platforms: APPLE_ONLY,
    };
    assert!(icloud.supports_platform(PlatformKind::Ios));
    assert!(!icloud.supports_platform(PlatformKind::Linux));

    let token = AuthToken {
        access_token: "ya29.test".to_string(),
        expires_at_ms: 10_000,
    };
    assert!(!token.is_expired(5_000, 1_000));
    assert!(token.is_expired(9_000, 1_000));
    assert!(token.is_expired(12_000, 0));

    let session = CloudSession {
        provider_id: "google_drive".to_string(),
        account_label: Some("user@example.com".to_string()),
        connected: true,
    };
    assert!(session.connected);

    let errors = [
        CloudStorageError::NotFound("sync-manifest.json".to_string()),
        CloudStorageError::PreconditionFailed("etag mismatch".to_string()),
        CloudStorageError::Unauthorized("expired token".to_string()),
        CloudStorageError::Network("timeout".to_string()),
        CloudStorageError::Other("unexpected".to_string()),
    ];
    for err in &errors {
        assert!(!err.to_string().is_empty());
    }
}
