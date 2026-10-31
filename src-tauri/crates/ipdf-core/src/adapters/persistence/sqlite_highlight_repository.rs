use crate::core::domain::{Highlight, HighlightAnchor, RichAnnotation};
use crate::core::ports::{HighlightRepository, PlatformEnvironment};
use rusqlite::{params, Connection, OptionalExtension, Row};
use std::fmt::Display;
use std::fs;
use std::path::Path;

fn to_err<E: Display>(err: E) -> String {
    err.to_string()
}

// Centralized SQL queries
const INIT_SCHEMA_SQL: &str = "
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

const UPSERT_SQL: &str = "
    INSERT OR REPLACE INTO highlights (
        id, book_hash, page_number, text, color, anchor_json,
        note, created_at_ms, updated_at_ms, annotations_json
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
";

const FIND_BY_ID_SQL: &str = "SELECT id, book_hash, text, color, anchor_json, note, created_at_ms, updated_at_ms, annotations_json FROM highlights WHERE id = ?1";
const DELETE_BY_ID_SQL: &str = "DELETE FROM highlights WHERE id = ?1";
const FIND_BY_BOOK_SQL: &str = "SELECT id, book_hash, text, color, anchor_json, note, created_at_ms, updated_at_ms, annotations_json FROM highlights WHERE book_hash = ?1 ORDER BY created_at_ms ASC";
const FIND_BY_BOOK_AND_PAGE_SQL: &str = "SELECT id, book_hash, text, color, anchor_json, note, created_at_ms, updated_at_ms, annotations_json FROM highlights WHERE book_hash = ?1 AND page_number = ?2 ORDER BY created_at_ms ASC";

pub struct SqliteHighlightRepository {
    conn: Connection,
}

impl SqliteHighlightRepository {
    pub fn new(conn: Connection) -> Result<Self, String> {
        let repo = Self { conn };
        repo.initialize_schema()?;
        Ok(repo)
    }

    pub fn new_in_memory() -> Result<Self, String> {
        let conn = Connection::open_in_memory().map_err(to_err)?;
        Self::new(conn)
    }

    pub fn open_file<P: AsRef<Path>>(path: P) -> Result<Self, String> {
        if let Some(parent) = path.as_ref().parent() {
            if !parent.as_os_str().is_empty() && !parent.exists() {
                fs::create_dir_all(parent).map_err(to_err)?;
            }
        }
        let conn = Connection::open(path).map_err(to_err)?;
        Self::new(conn)
    }

    pub fn open_for_platform<E: PlatformEnvironment + ?Sized>(env: &E) -> Result<Self, String> {
        let db_path = env.resolve_database_path("ipdf.db")?;
        Self::open_file(db_path)
    }

    fn initialize_schema(&self) -> Result<(), String> {
        self.conn.execute_batch(INIT_SCHEMA_SQL).map_err(to_err)
    }

    fn row_to_highlight(row: &Row<'_>) -> rusqlite::Result<Result<Highlight, String>> {
        let id: String = row.get("id")?;
        let book_hash: String = row.get("book_hash")?;
        let text: String = row.get("text")?;
        let color: String = row.get("color")?;
        let anchor_json: String = row.get("anchor_json")?;
        let note: String = row.get("note")?;
        let created_at_ms: i64 = row.get("created_at_ms")?;
        let updated_at_ms: i64 = row.get("updated_at_ms")?;
        let annotations_json: String = row.get("annotations_json")?;

        let anchor: HighlightAnchor = match serde_json::from_str(&anchor_json) {
            Ok(a) => a,
            Err(e) => return Ok(Err(e.to_string())),
        };
        let annotations: Vec<RichAnnotation> = match serde_json::from_str(&annotations_json) {
            Ok(list) => list,
            Err(e) => return Ok(Err(e.to_string())),
        };

        let mut hl = Highlight::new(id, book_hash, text, color, anchor, note, created_at_ms);
        for ann in annotations {
            hl.set_rich_annotation(ann, updated_at_ms);
        }
        hl.updated_at_ms = updated_at_ms;
        Ok(Ok(hl))
    }
}

impl HighlightRepository for SqliteHighlightRepository {
    fn save(&mut self, highlight: Highlight) -> Result<(), String> {
        let anchor_json = serde_json::to_string(&highlight.anchor).map_err(to_err)?;
        let annotations_vec: Vec<RichAnnotation> =
            highlight.annotations.values().cloned().collect();
        let annotations_json = serde_json::to_string(&annotations_vec).map_err(to_err)?;

        self.conn
            .execute(
                UPSERT_SQL,
                params![
                    highlight.id,
                    highlight.book_hash,
                    highlight.anchor.page_number,
                    highlight.text,
                    highlight.color,
                    anchor_json,
                    highlight.note,
                    highlight.created_at_ms,
                    highlight.updated_at_ms,
                    annotations_json,
                ],
            )
            .map_err(to_err)?;
        Ok(())
    }

    fn find_by_id(&self, id: &str) -> Result<Option<Highlight>, String> {
        let mut stmt = self.conn.prepare(FIND_BY_ID_SQL).map_err(to_err)?;

        let raw = stmt
            .query_row(params![id], Self::row_to_highlight)
            .optional()
            .map_err(to_err)?;

        match raw {
            Some(res) => Ok(Some(res?)),
            None => Ok(None),
        }
    }

    fn update(&mut self, highlight: Highlight) -> Result<(), String> {
        self.save(highlight)
    }

    fn delete(&mut self, id: &str) -> Result<(), String> {
        self.conn
            .execute(DELETE_BY_ID_SQL, params![id])
            .map_err(to_err)?;
        Ok(())
    }

    fn find_by_book(&self, book_hash: &str) -> Result<Vec<Highlight>, String> {
        let mut stmt = self.conn.prepare(FIND_BY_BOOK_SQL).map_err(to_err)?;

        let rows = stmt
            .query_map(params![book_hash], Self::row_to_highlight)
            .map_err(to_err)?;

        let mut list = Vec::new();
        for row in rows {
            list.push(row.map_err(to_err)??);
        }
        Ok(list)
    }

    fn find_by_book_and_page(
        &self,
        book_hash: &str,
        page_number: u32,
    ) -> Result<Vec<Highlight>, String> {
        let mut stmt = self
            .conn
            .prepare(FIND_BY_BOOK_AND_PAGE_SQL)
            .map_err(to_err)?;

        let rows = stmt
            .query_map(params![book_hash, page_number], Self::row_to_highlight)
            .map_err(to_err)?;

        let mut list = Vec::new();
        for row in rows {
            list.push(row.map_err(to_err)??);
        }
        Ok(list)
    }
}
