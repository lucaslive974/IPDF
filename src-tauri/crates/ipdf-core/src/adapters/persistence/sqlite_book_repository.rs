use crate::core::domain::{BookFormat, BookMetadata, BookStorageLocation};
use crate::core::ports::{BookRepository, PlatformEnvironment};
use rusqlite::{params, Connection, Row};
use std::path::Path;

fn to_err<E: std::fmt::Display>(e: E) -> String {
    e.to_string()
}

const CREATE_BOOKS_TABLE_SQL: &str = "
    CREATE TABLE IF NOT EXISTS books (
        hash TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        author TEXT NOT NULL,
        format TEXT NOT NULL,
        current_page INTEGER NOT NULL DEFAULT 1,
        total_pages INTEGER NOT NULL DEFAULT 1,
        percentage REAL NOT NULL DEFAULT 0.0,
        cover_image_url TEXT,
        description TEXT,
        last_read_at_ms INTEGER NOT NULL,
        updated_at_ms INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_books_last_read
        ON books (last_read_at_ms DESC);
";

const CREATE_LOCATIONS_TABLE_SQL: &str = "
    CREATE TABLE IF NOT EXISTS book_storage_locations (
        book_hash TEXT NOT NULL,
        provider_id TEXT NOT NULL,
        storage_path TEXT NOT NULL,
        is_downloaded INTEGER NOT NULL DEFAULT 1,
        last_synced_at_ms INTEGER,
        PRIMARY KEY (book_hash, provider_id),
        FOREIGN KEY (book_hash) REFERENCES books(hash) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_locations_book_hash
        ON book_storage_locations (book_hash);
";

const UPSERT_BOOK_SQL: &str = "
    INSERT OR REPLACE INTO books (
        hash, title, author, format, current_page, total_pages,
        percentage, cover_image_url, description, last_read_at_ms, updated_at_ms
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
";

const FIND_BOOK_BY_HASH_SQL: &str = "
    SELECT hash, title, author, format, current_page, total_pages,
           percentage, cover_image_url, description, last_read_at_ms, updated_at_ms
    FROM books WHERE hash = ?1
";

const LIST_BOOKS_SQL: &str = "
    SELECT hash, title, author, format, current_page, total_pages,
           percentage, cover_image_url, description, last_read_at_ms, updated_at_ms
    FROM books ORDER BY last_read_at_ms DESC
";

const DELETE_BOOK_SQL: &str = "DELETE FROM books WHERE hash = ?1";

const UPSERT_LOCATION_SQL: &str = "
    INSERT OR REPLACE INTO book_storage_locations (
        book_hash, provider_id, storage_path, is_downloaded, last_synced_at_ms
    ) VALUES (?1, ?2, ?3, ?4, ?5)
";

const GET_LOCATIONS_SQL: &str = "
    SELECT book_hash, provider_id, storage_path, is_downloaded, last_synced_at_ms
    FROM book_storage_locations WHERE book_hash = ?1
";

const DELETE_LOCATION_SQL: &str = "
    DELETE FROM book_storage_locations WHERE book_hash = ?1 AND provider_id = ?2
";

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
        if let Some(parent) = path.as_ref().parent() {
            if !parent.as_os_str().is_empty() && !parent.exists() {
                std::fs::create_dir_all(parent).map_err(to_err)?;
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
        self.conn
            .execute("PRAGMA foreign_keys = ON;", [])
            .map_err(to_err)?;
        self.conn
            .execute_batch(CREATE_BOOKS_TABLE_SQL)
            .map_err(to_err)?;
        self.conn
            .execute_batch(CREATE_LOCATIONS_TABLE_SQL)
            .map_err(to_err)?;
        Ok(())
    }

    fn row_to_book(row: &Row<'_>) -> rusqlite::Result<BookMetadata> {
        let format_str: String = row.get(3)?;
        let format = match format_str.to_lowercase().as_str() {
            "pdf" => BookFormat::Pdf,
            _ => BookFormat::Epub,
        };

        Ok(BookMetadata {
            book_hash: row.get(0)?,
            title: row.get(1)?,
            author: row.get(2)?,
            format,
            current_page: row.get(4)?,
            total_pages: row.get(5)?,
            percentage: row.get(6)?,
            cover_image_url: row.get(7)?,
            description: row.get(8)?,
            last_read_at_ms: row.get(9)?,
            updated_at_ms: row.get(10)?,
        })
    }

    fn row_to_location(row: &Row<'_>) -> rusqlite::Result<BookStorageLocation> {
        let is_downloaded_int: i64 = row.get(3)?;
        Ok(BookStorageLocation {
            book_hash: row.get(0)?,
            provider_id: row.get(1)?,
            storage_path: row.get(2)?,
            is_downloaded: is_downloaded_int == 1,
            last_synced_at_ms: row.get(4)?,
        })
    }
}

impl BookRepository for SqliteBookRepository {
    fn save_book(&mut self, book: BookMetadata) -> Result<(), String> {
        let format_str = match book.format {
            BookFormat::Epub => "epub",
            BookFormat::Pdf => "pdf",
        };

        self.conn
            .execute(
                UPSERT_BOOK_SQL,
                params![
                    book.book_hash,
                    book.title,
                    book.author,
                    format_str,
                    book.current_page,
                    book.total_pages,
                    book.percentage,
                    book.cover_image_url,
                    book.description,
                    book.last_read_at_ms,
                    book.updated_at_ms,
                ],
            )
            .map_err(to_err)?;
        Ok(())
    }

    fn find_book_by_hash(&self, hash: &str) -> Result<Option<BookMetadata>, String> {
        let mut stmt = self.conn.prepare(FIND_BOOK_BY_HASH_SQL).map_err(to_err)?;
        let mut rows = stmt
            .query_map(params![hash], Self::row_to_book)
            .map_err(to_err)?;

        if let Some(row) = rows.next() {
            let book = row.map_err(to_err)?;
            Ok(Some(book))
        } else {
            Ok(None)
        }
    }

    fn list_books(&self) -> Result<Vec<BookMetadata>, String> {
        let mut stmt = self.conn.prepare(LIST_BOOKS_SQL).map_err(to_err)?;
        let rows = stmt.query_map([], Self::row_to_book).map_err(to_err)?;

        let mut books = Vec::new();
        for r in rows {
            books.push(r.map_err(to_err)?);
        }
        Ok(books)
    }

    fn delete_book(&mut self, hash: &str) -> Result<bool, String> {
        let count = self
            .conn
            .execute(DELETE_BOOK_SQL, params![hash])
            .map_err(to_err)?;
        Ok(count > 0)
    }

    fn add_storage_location(&mut self, location: BookStorageLocation) -> Result<(), String> {
        self.conn
            .execute(
                UPSERT_LOCATION_SQL,
                params![
                    location.book_hash,
                    location.provider_id,
                    location.storage_path,
                    if location.is_downloaded { 1 } else { 0 },
                    location.last_synced_at_ms,
                ],
            )
            .map_err(to_err)?;
        Ok(())
    }

    fn get_storage_locations(&self, book_hash: &str) -> Result<Vec<BookStorageLocation>, String> {
        let mut stmt = self.conn.prepare(GET_LOCATIONS_SQL).map_err(to_err)?;
        let rows = stmt
            .query_map(params![book_hash], Self::row_to_location)
            .map_err(to_err)?;

        let mut locs = Vec::new();
        for r in rows {
            locs.push(r.map_err(to_err)?);
        }
        Ok(locs)
    }

    fn remove_storage_location(
        &mut self,
        book_hash: &str,
        provider_id: &str,
    ) -> Result<bool, String> {
        let count = self
            .conn
            .execute(DELETE_LOCATION_SQL, params![book_hash, provider_id])
            .map_err(to_err)?;
        Ok(count > 0)
    }
}
