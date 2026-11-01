use crate::core::ports::{BookCoverExtractor, ExtractedCover};

#[derive(Default, Debug, Clone)]
pub struct PdfCoverExtractor;

impl PdfCoverExtractor {
    pub fn new() -> Self {
        Self
    }
}

impl BookCoverExtractor for PdfCoverExtractor {
    fn extract_cover(&self, raw_bytes: &[u8]) -> Option<ExtractedCover> {
        if !raw_bytes.starts_with(b"%PDF-") {
            return None;
        }

        // Look for embedded JPEG stream in the initial section of the PDF (typically page 1 image)
        // JPEG SOI is [0xFF, 0xD8, 0xFF], EOI is [0xFF, 0xD9]
        let max_scan = raw_bytes.len().min(1024 * 1024); // scan up to first 1MB
        let slice = &raw_bytes[..max_scan];

        if let Some(start_idx) = slice.windows(3).position(|w| w == [0xFF, 0xD8, 0xFF]) {
            if let Some(end_rel) = slice[start_idx..]
                .windows(2)
                .position(|w| w == [0xFF, 0xD9])
            {
                let end_idx = start_idx + end_rel + 2;
                let jpeg_bytes = slice[start_idx..end_idx].to_vec();
                if jpeg_bytes.len() > 100 {
                    return Some(ExtractedCover {
                        mime_type: "image/jpeg".to_string(),
                        extension: "jpg".to_string(),
                        data: jpeg_bytes,
                    });
                }
            }
        }

        None
    }
}
