pub mod epub_book_paginator;
pub mod pdf_book_paginator;

pub use epub_book_paginator::EpubBookPaginator;
pub use pdf_book_paginator::PdfBookPaginator;

use crate::core::domain::BookFormat;
use crate::core::ports::BookPaginator;

pub struct BookPaginatorFactory;

impl BookPaginatorFactory {
    pub fn create(format: BookFormat) -> Box<dyn BookPaginator> {
        match format {
            BookFormat::Epub => Box::new(EpubBookPaginator::new()),
            BookFormat::Pdf => Box::new(PdfBookPaginator::new()),
        }
    }
}
