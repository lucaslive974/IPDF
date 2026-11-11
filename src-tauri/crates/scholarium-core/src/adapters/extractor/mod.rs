pub mod cover_extractor_adapter;
pub mod epub_cover_extractor;
pub mod pdf_cover_extractor;

pub use cover_extractor_adapter::CoverExtractorAdapter;
pub use epub_cover_extractor::EpubCoverExtractor;
pub use pdf_cover_extractor::PdfCoverExtractor;

use crate::core::domain::BookFormat;
use crate::core::ports::BookCoverExtractor;

pub struct BookCoverExtractorFactory;

impl BookCoverExtractorFactory {
    pub fn create(format: BookFormat) -> Box<dyn BookCoverExtractor> {
        match format {
            BookFormat::Epub => Box::new(EpubCoverExtractor::new()),
            BookFormat::Pdf => Box::new(PdfCoverExtractor::new()),
        }
    }
}
