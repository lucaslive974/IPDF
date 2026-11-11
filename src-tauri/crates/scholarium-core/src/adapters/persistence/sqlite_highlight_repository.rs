use super::sqlite_highlight_queries as queries;
use crate::core::domain::{Highlight, HighlightAnchor, RichAnnotation};
use crate::core::ports::{HighlightRepository, PlatformEnvironment};
use rusqlite::{params, Connection, OptionalExtension, Row};
use std::fmt::Display;
use std::fs;
use std::path::Path;

fn to_err<E: Display>(err: E) -> String {
    err.to_string()
}

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
        let db_path = env.resolve_database_path("scholarium.db")?;
        Self::open_file(db_path)
    }

    fn initialize_schema(&self) -> Result<(), String> {
        self.conn
            .execute_batch(queries::INIT_SCHEMA)
            .map_err(to_err)
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
                queries::UPSERT,
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
        let mut stmt = self.conn.prepare(queries::FIND_BY_ID).map_err(to_err)?;

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
            .execute(queries::DELETE_BY_ID, params![id])
            .map_err(to_err)?;
        Ok(())
    }

    fn delete_by_book(&mut self, book_hash: &str) -> Result<usize, String> {
        let count = self
            .conn
            .execute(queries::DELETE_BY_BOOK, params![book_hash])
            .map_err(to_err)?;
        Ok(count)
    }

    fn find_by_book(&self, book_hash: &str) -> Result<Vec<Highlight>, String> {
        let mut stmt = self.conn.prepare(queries::FIND_BY_BOOK).map_err(to_err)?;

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
            .prepare(queries::FIND_BY_BOOK_AND_PAGE)
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

    fn find_all(&self) -> Result<Vec<Highlight>, String> {
        let mut stmt = self.conn.prepare(queries::FIND_ALL).map_err(to_err)?;
        let rows = stmt.query_map([], Self::row_to_highlight).map_err(to_err)?;

        let mut list = Vec::new();
        for row in rows {
            list.push(row.map_err(to_err)??);
        }
        Ok(list)
    }
}
