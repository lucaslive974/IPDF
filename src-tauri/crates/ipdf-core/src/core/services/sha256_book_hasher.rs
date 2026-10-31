use sha2::{Digest, Sha256};
use std::io::Read;

pub struct Sha256BookHasher;

impl Sha256BookHasher {
    pub fn hash_stream<R: Read>(mut reader: R) -> Result<String, String> {
        let mut hasher = Sha256::new();
        let mut buffer = [0u8; 64 * 1024];
        loop {
            let bytes_read = reader.read(&mut buffer).map_err(|e| e.to_string())?;
            if bytes_read == 0 {
                break;
            }
            hasher.update(&buffer[..bytes_read]);
        }
        let digest = hasher.finalize();
        Ok(digest.iter().map(|b| format!("{b:02x}")).collect())
    }
}
