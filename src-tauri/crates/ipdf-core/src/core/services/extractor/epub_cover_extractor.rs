use crate::core::ports::{BookCoverExtractor, ExtractedCover};
use std::io::{Cursor, Read};

#[derive(Default, Debug, Clone)]
pub struct EpubCoverExtractor;

impl EpubCoverExtractor {
    pub fn new() -> Self {
        Self
    }

    fn mime_and_ext_for_name(name: &str) -> Option<(&'static str, &'static str)> {
        let lower = name.to_lowercase();
        if lower.ends_with(".png") {
            Some(("image/png", "png"))
        } else if lower.ends_with(".webp") {
            Some(("image/webp", "webp"))
        } else if lower.ends_with(".jpg") || lower.ends_with(".jpeg") {
            Some(("image/jpeg", "jpg"))
        } else {
            None
        }
    }
}

impl BookCoverExtractor for EpubCoverExtractor {
    fn extract_cover(&self, raw_bytes: &[u8]) -> Option<ExtractedCover> {
        if raw_bytes.len() < 30 || !raw_bytes.starts_with(b"PK\x03\x04") {
            return None;
        }

        let cursor = Cursor::new(raw_bytes);
        let mut archive = zip::ZipArchive::new(cursor).ok()?;

        let mut opf_cover_href: Option<String> = None;
        let mut fallback_cover_index: Option<usize> = None;

        // Step 1: Scan files for content.opf and candidate cover filenames
        for i in 0..archive.len() {
            let Ok(file) = archive.by_index(i) else {
                continue;
            };
            let Ok(file_name) = file.name() else {
                continue;
            };
            let lower_name = file_name.to_lowercase();

            if lower_name.ends_with(".opf") {
                drop(file);
                if let Ok(mut opf_file) = archive.by_index(i) {
                    let mut opf_content = String::new();
                    if opf_file.read_to_string(&mut opf_content).is_ok() {
                        opf_cover_href = Self::find_cover_href_in_opf(&opf_content);
                    }
                }
            } else if fallback_cover_index.is_none()
                && Self::mime_and_ext_for_name(&lower_name).is_some()
                && (lower_name.contains("cover") || lower_name.contains("titlepage"))
            {
                fallback_cover_index = Some(i);
            }
        }

        // Step 2: If OPF specified a cover image href, try to find and extract that exact entry
        if let Some(href) = opf_cover_href {
            let clean_href = href.trim_matches('/');
            let mut target_index = None;
            let mut target_mime_ext = None;
            for i in 0..archive.len() {
                if let Ok(file) = archive.by_index(i) {
                    if let Ok(file_name) = file.name() {
                        if file_name.ends_with(clean_href) {
                            if let Some((mime, ext)) = Self::mime_and_ext_for_name(&file_name) {
                                target_index = Some(i);
                                target_mime_ext = Some((mime, ext));
                                break;
                            }
                        }
                    }
                }
            }

            if let (Some(idx), Some((mime, ext))) = (target_index, target_mime_ext) {
                if let Ok(mut target_file) = archive.by_index(idx) {
                    let mut buffer = Vec::new();
                    if target_file.read_to_end(&mut buffer).is_ok() && !buffer.is_empty() {
                        return Some(ExtractedCover {
                            mime_type: mime.to_string(),
                            extension: ext.to_string(),
                            data: buffer,
                        });
                    }
                }
            }
        }

        // Step 3: Fallback to candidate image index if found
        if let Some(idx) = fallback_cover_index {
            if let Ok(mut file) = archive.by_index(idx) {
                if let Ok(file_name) = file.name() {
                    if let Some((mime, ext)) = Self::mime_and_ext_for_name(&file_name) {
                        let mut buffer = Vec::new();
                        if file.read_to_end(&mut buffer).is_ok() && !buffer.is_empty() {
                            return Some(ExtractedCover {
                                mime_type: mime.to_string(),
                                extension: ext.to_string(),
                                data: buffer,
                            });
                        }
                    }
                }
            }
        }

        None
    }
}

impl EpubCoverExtractor {
    fn find_cover_href_in_opf(opf: &str) -> Option<String> {
        let lower = opf.to_lowercase();

        // 1. Check for item with properties="cover-image"
        if let Some(pos) = lower.find("cover-image") {
            let tag_start = lower[..pos].rfind("<item")?;
            let tag_end = lower[tag_start..].find('>')? + tag_start;
            let tag = &opf[tag_start..tag_end];
            if let Some(href) = Self::extract_attribute_value(tag, "href") {
                return Some(href);
            }
        }

        // 2. Check for item with id="cover" or id="cover-image"
        for id_candidate in &["id=\"cover\"", "id=\"cover-image\"", "id='cover'"] {
            if let Some(pos) = lower.find(id_candidate) {
                let tag_start = lower[..pos].rfind("<item")?;
                let tag_end = lower[tag_start..].find('>')? + tag_start;
                let tag = &opf[tag_start..tag_end];
                if let Some(href) = Self::extract_attribute_value(tag, "href") {
                    return Some(href);
                }
            }
        }

        None
    }

    fn extract_attribute_value(tag: &str, attr: &str) -> Option<String> {
        let pattern = format!("{attr}=\"");
        if let Some(start) = tag.find(&pattern) {
            let value_start = start + pattern.len();
            if let Some(end) = tag[value_start..].find('"') {
                return Some(tag[value_start..value_start + end].to_string());
            }
        }
        let pattern_single = format!("{attr}='");
        if let Some(start) = tag.find(&pattern_single) {
            let value_start = start + pattern_single.len();
            if let Some(end) = tag[value_start..].find('\'') {
                return Some(tag[value_start..value_start + end].to_string());
            }
        }
        None
    }
}
