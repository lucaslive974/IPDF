use crate::core::domain::BookFormat;
use crate::core::ports::StorageProvider;
use crate::core::services::BookCoverExtractorFactory;
use base64::Engine;

pub struct CoverExtractorAdapter;

impl CoverExtractorAdapter {
    pub fn resolve_cover_data_url<S: StorageProvider + ?Sized>(
        storage: &mut S,
        book_hash: &str,
        cover_ref: Option<&str>,
    ) -> Option<String> {
        if let Some(url) = cover_ref {
            if url.starts_with("data:") || url.starts_with("http://") || url.starts_with("https://")
            {
                return Some(url.to_string());
            }
        }

        if let Some(path) = cover_ref {
            let entry_name = if let Some(idx) = path.find("covers/") {
                &path[idx..]
            } else {
                path
            };
            if let Ok(Some(bytes)) = storage.read_entry(entry_name) {
                let mime = if entry_name.ends_with(".png") {
                    "image/png"
                } else if entry_name.ends_with(".webp") {
                    "image/webp"
                } else {
                    "image/jpeg"
                };
                let encoded = base64::engine::general_purpose::STANDARD.encode(&bytes);
                return Some(format!("data:{};base64,{}", mime, encoded));
            }
        }

        for ext in &["jpg", "jpeg", "png", "webp"] {
            let candidate = format!("covers/{}.{}", book_hash, ext);
            if let Ok(Some(bytes)) = storage.read_entry(&candidate) {
                let mime = match *ext {
                    "png" => "image/png",
                    "webp" => "image/webp",
                    _ => "image/jpeg",
                };
                let encoded = base64::engine::general_purpose::STANDARD.encode(&bytes);
                return Some(format!("data:{};base64,{}", mime, encoded));
            }
        }

        None
    }

    pub fn extract_and_persist_cover<S: StorageProvider + ?Sized>(
        storage: &mut S,
        format: BookFormat,
        book_hash: &str,
        raw_bytes: &[u8],
    ) -> Option<String> {
        let extractor = BookCoverExtractorFactory::create(format);
        if let Some(cover) = extractor.extract_cover(raw_bytes) {
            let entry_name = format!("covers/{}.{}", book_hash, cover.extension);
            if storage
                .write_entry(&entry_name, &cover.data, &cover.mime_type)
                .is_ok()
            {
                return Some(entry_name);
            }
        }
        None
    }
}
