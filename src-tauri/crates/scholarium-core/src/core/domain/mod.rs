pub mod book_metadata;
pub mod book_storage_location;
pub mod highlight;
pub mod rich_annotation;
pub mod types;

pub use book_metadata::BookMetadata;
pub use book_storage_location::BookStorageLocation;
pub use highlight::Highlight;
pub use rich_annotation::RichAnnotation;
pub use types::{
    BookFormat, BookPagePayload, BoundingBox, HighlightAnchor, PlatformKind, RichAnnotationType,
};
