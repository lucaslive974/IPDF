use crate::core::domain::BookPagePayload;

pub trait BookPaginator: Send + Sync {
    fn paginate(
        &self,
        raw_bytes: &[u8],
        target_total_pages: u32,
    ) -> Result<Vec<BookPagePayload>, String>;
}
