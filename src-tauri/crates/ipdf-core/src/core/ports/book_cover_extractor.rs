#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ExtractedCover {
    pub mime_type: String,
    pub extension: String,
    pub data: Vec<u8>,
}

pub trait BookCoverExtractor: Send + Sync {
    fn extract_cover(&self, raw_bytes: &[u8]) -> Option<ExtractedCover>;
}
