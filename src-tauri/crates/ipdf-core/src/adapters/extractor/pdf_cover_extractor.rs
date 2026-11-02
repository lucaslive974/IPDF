use crate::core::ports::{BookCoverExtractor, ExtractedCover};

#[derive(Default, Debug, Clone)]
pub struct PdfCoverExtractor;

impl PdfCoverExtractor {
    pub fn new() -> Self {
        Self
    }
}

impl BookCoverExtractor for PdfCoverExtractor {
    /// For PDF documents, cover extraction from raw binary scanning is intentionally disabled.
    /// PDF page 1 rasterization is handled by the viewer (PDF.js) on the client side
    /// to ensure 100% visual fidelity without corrupted byte stream extraction.
    fn extract_cover(&self, _raw_bytes: &[u8]) -> Option<ExtractedCover> {
        None
    }
}
