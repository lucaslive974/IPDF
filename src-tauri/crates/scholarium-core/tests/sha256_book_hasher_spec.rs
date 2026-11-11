use scholarium_core::core::services::Sha256BookHasher;
use std::io::Cursor;

#[test]
fn test_streaming_sha256_hasher() {
    let cursor = Cursor::new(b"plato-republic-binary-payload");
    let hash = Sha256BookHasher::hash_stream(cursor).expect("hash should succeed");
    assert_eq!(hash.len(), 64);
}
