pub const INIT_SCHEMA: &str = "
    CREATE TABLE IF NOT EXISTS highlights (
        id TEXT PRIMARY KEY,
        book_hash TEXT NOT NULL,
        page_number INTEGER NOT NULL,
        text TEXT NOT NULL,
        color TEXT NOT NULL,
        anchor_json TEXT NOT NULL,
        note TEXT NOT NULL,
        created_at_ms INTEGER NOT NULL,
        updated_at_ms INTEGER NOT NULL,
        annotations_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_highlights_book_page
        ON highlights (book_hash, page_number);
";

pub const UPSERT: &str = "
    INSERT OR REPLACE INTO highlights (
        id, book_hash, page_number, text, color, anchor_json,
        note, created_at_ms, updated_at_ms, annotations_json
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
";

pub const FIND_BY_ID: &str = "SELECT id, book_hash, text, color, anchor_json, note, created_at_ms, updated_at_ms, annotations_json FROM highlights WHERE id = ?1";

pub const DELETE_BY_ID: &str = "DELETE FROM highlights WHERE id = ?1";

pub const DELETE_BY_BOOK: &str = "DELETE FROM highlights WHERE book_hash = ?1";

pub const FIND_BY_BOOK: &str = "SELECT id, book_hash, text, color, anchor_json, note, created_at_ms, updated_at_ms, annotations_json FROM highlights WHERE book_hash = ?1 ORDER BY created_at_ms ASC";

pub const FIND_BY_BOOK_AND_PAGE: &str = "SELECT id, book_hash, text, color, anchor_json, note, created_at_ms, updated_at_ms, annotations_json FROM highlights WHERE book_hash = ?1 AND page_number = ?2 ORDER BY created_at_ms ASC";

pub const FIND_ALL: &str = "SELECT id, book_hash, text, color, anchor_json, note, created_at_ms, updated_at_ms, annotations_json FROM highlights ORDER BY updated_at_ms DESC";
