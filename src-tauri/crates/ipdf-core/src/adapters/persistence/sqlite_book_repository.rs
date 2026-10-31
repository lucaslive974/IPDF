use crate::core::domain::{BookFormat, BookMetadata};
use crate::core::ports::BookRepository;
use rusqlite::{params, Connection, OptionalExtension};
use std::fmt::Display;
use std::path::Path;

fn to_err<E: Display>(err: E) -> String {
    err.to_string()
}

pub struct SqliteBookRepository {
    conn: Connection,
}

impl SqliteBookRepository {
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
        let conn = Connection::open(path).map_err(to_err)?;
        Self::new(conn)
    }

    fn initialize_schema(&self) -> Result<(), String> {
        self.conn
            .execute_batch(
                "CREATE TABLE IF NOT EXISTS books (
                    book_hash TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    author TEXT NOT NULL,
                    format TEXT NOT NULL,
                    current_page INTEGER NOT NULL,
                    total_pages INTEGER NOT NULL,
                    percentage REAL NOT NULL,
                    cover_image_url TEXT,
                    last_read_at_ms INTEGER NOT NULL,
                    updated_at_ms INTEGER NOT NULL
                );",
            )
            .map_err(to_err)
    }

    fn format_to_str(format: BookFormat) -> &'static str {
        match format {
            BookFormat::Epub => "epub",
            BookFormat::Pdf => "pdf",
        }
    }

    fn str_to_format(value: &str) -> BookFormat {
        match value {
            "pdf" => BookFormat::Pdf,
            _ => BookFormat::Epub,
        }
    }

    fn map_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<BookMetadata> {
        let format_str: String = row.get(3)?;
        Ok(BookMetadata {
            book_hash: row.get(0)?,
            title: row.get(1)?,
            author: row.get(2)?,
            format: Self::str_to_format(&format_str),
            current_page: row.get(4)?,
            total_pages: row.get(5)?,
            percentage: row.get(6)?,
            cover_image_url: row.get(7)?,
            last_read_at_ms: row.get(8)?,
            updated_at_ms: row.get(9)?,
        })
    }
}

impl BookRepository for SqliteBookRepository {
    fn save(&mut self, book: BookMetadata) -> Result<(), String> {
        self.conn
            .execute(
                "INSERT OR REPLACE INTO books (
                    book_hash, title, author, format, current_page, total_pages,
                    percentage, cover_image_url, last_read_at_ms, updated_at_ms
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                params![
                    book.book_hash,
                    book.title,
                    book.author,
                    Self::format_to_str(book.format),
                    book.current_page,
                    book.total_pages,
                    book.percentage,
                    book.cover_image_url,
                    book.last_read_at_ms,
                    book.updated_at_ms,
                ],
            )
            .map_err(to_err)?;
        Ok(())
    }

    fn find_by_id(&self, book_hash: &str) -> Result<Option<BookMetadata>, String> {
        let mut stmt = self
            .conn
            .prepare(
                "SELECT book_hash, title, author, format, current_page, total_pages,
                        percentage, cover_image_url, last_read_at_ms, updated_at_ms
                 FROM books WHERE book_hash = ?1",
            )
            .map_err(to_err)?;

        stmt.query_row(params![book_hash], Self::map_row)
            .optional()
            .map_err(to_err)
    }

    fn update(&mut self, book: BookMetadata) -> Result<(), String> {
        self.save(book)
    }

    fn delete(&mut self, book_hash: &str) -> Result<(), String> {
        self.conn
            .execute("DELETE FROM books WHERE book_hash = ?1", params![book_hash])
            .map_err(to_err)?;
        Ok(())
    }

    fn find_all(&self) -> Result<Vec<BookMetadata>, String> {
        let mut stmt = self
            .conn
            .prepare(
                "SELECT book_hash, title, author, format, current_page, total_pages,
                        percentage, cover_image_url, last_read_at_ms, updated_at_ms
                 FROM books ORDER BY last_read_at_ms DESC",
            )
            .map_err(to_err)?;

        let rows = stmt.query_map([], Self::map_row).map_err(to_err)?;

        let mut list = Vec::new();
        for row in rows {
            list.push(row.map_err(to_err)?);
        }
        Ok(list)
    }
}
