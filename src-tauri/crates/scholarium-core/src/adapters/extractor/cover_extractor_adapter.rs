use super::BookCoverExtractorFactory;
use crate::core::domain::BookFormat;
use crate::core::ports::ExtractedCover;

pub struct CoverExtractorAdapter;

impl CoverExtractorAdapter {
    pub fn extract_cover(format: BookFormat, raw_bytes: &[u8]) -> Option<ExtractedCover> {
        let extractor = BookCoverExtractorFactory::create(format);
        extractor.extract_cover(raw_bytes)
    }
}
