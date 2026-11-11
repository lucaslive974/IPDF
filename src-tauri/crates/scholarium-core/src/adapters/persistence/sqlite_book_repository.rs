use super::sqlite_book_queries as queries;
use crate::core::domain::{BookFormat, BookMetadata, BookStorageLocation};
use crate::core::ports::{BookRepository, PlatformEnvironment};
use rusqlite::{params, Connection, Row};
use std::path::Path;

fn to_err<E: std::fmt::Display>(e: E) -> String {
    e.to_string()
}

pub struct SqliteBookRepository {
    conn: Connection,
}

fn is_system_or_placeholder_author(author: &str) -> bool {
    let lower = author.trim().to_lowercase();
    lower.is_empty() || lower == "unknown" || lower == "unknown author" || lower == "local file"
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
        let db_path = env.resolve_database_path("scholarium.db")?;
        Self::open_file(db_path)
    }

    fn initialize_schema(&self) -> Result<(), String> {
        self.conn
            .execute(queries::PRAGMA_FOREIGN_KEYS_ON, [])
            .map_err(to_err)?;
        self.conn
            .execute_batch(queries::CREATE_BOOKS_TABLE)
            .map_err(to_err)?;
        let _ = self
            .conn
            .execute(queries::MIGRATION_ADD_PAGE_OFFSET_RATIO, []);
        let _ = self
            .conn
            .execute(queries::MIGRATION_SET_DEFAULT_PAGE_OFFSET_RATIO, []);
        self.conn
            .execute_batch(queries::CREATE_LOCATIONS_TABLE)
            .map_err(to_err)?;
        self.conn
            .execute_batch(queries::CREATE_AUTHORS_TAGS_TABLES)
            .map_err(to_err)?;
        let _ = self
            .conn
            .execute(queries::MIGRATION_NORMALIZE_UNKNOWN_AUTHOR, []);
        let _ = Self::prune_orphaned_metadata(&self.conn);
        Ok(())
    }

    fn prune_orphaned_metadata(conn: &Connection) -> Result<(), rusqlite::Error> {
        conn.execute(queries::PRUNE_ORPHANED_TAGS, [])?;
        conn.execute(queries::PRUNE_ORPHANED_AUTHORS, [])?;
        Ok(())
    }

    fn save_book_tags_and_author(
        conn: &Connection,
        book_hash: &str,
        author: &str,
        tags: &[String],
        now_ms: i64,
    ) -> Result<(), rusqlite::Error> {
        let trimmed_author = author.trim();
        if !is_system_or_placeholder_author(trimmed_author) {
            conn.execute(queries::INSERT_AUTHOR, params![trimmed_author, now_ms])?;
        }

        conn.execute(queries::DELETE_BOOK_TAGS, params![book_hash])?;

        for tag in tags {
            let trimmed = tag.trim();
            if trimmed.is_empty() {
                continue;
            }
            conn.execute(queries::INSERT_TAG, params![trimmed])?;
            let tag_id: i64 =
                conn.query_row(queries::FIND_TAG_ID_BY_NAME, params![trimmed], |r| r.get(0))?;
            conn.execute(queries::INSERT_BOOK_TAG, params![book_hash, tag_id])?;
        }

        Self::prune_orphaned_metadata(conn)?;
        Ok(())
    }

    fn load_tags_for_book(
        conn: &Connection,
        book_hash: &str,
    ) -> Result<Vec<String>, rusqlite::Error> {
        let mut stmt = conn.prepare(queries::LOAD_TAGS_FOR_BOOK)?;
        let rows = stmt.query_map(params![book_hash], |r| r.get::<_, String>(0))?;
        let mut tags = Vec::new();
        for t in rows {
            tags.push(t?);
        }
        Ok(tags)
    }

    fn row_to_book(row: &Row<'_>) -> rusqlite::Result<BookMetadata> {
        let format_str: String = row.get(3)?;
        let format = match format_str.to_lowercase().as_str() {
            "pdf" => BookFormat::Pdf,
            _ => BookFormat::Epub,
        };

        let raw_author: String = row.get(2)?;
        let author = if raw_author.trim().eq_ignore_ascii_case("local file") {
            "Unknown".to_string()
        } else {
            raw_author
        };

        Ok(BookMetadata {
            book_hash: row.get(0)?,
            title: row.get(1)?,
            author,
            format,
            current_page: row.get(4)?,
            total_pages: row.get(5)?,
            percentage: row.get(6)?,
            cover_image_url: row.get(7)?,
            description: row.get(8)?,
            page_offset_ratio: row.get::<_, Option<f64>>(9)?.unwrap_or(0.0),
            tags: Vec::new(),
            last_read_at_ms: row.get(10)?,
            updated_at_ms: row.get(11)?,
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

        let author = if book.author.trim().eq_ignore_ascii_case("local file") {
            "Unknown".to_string()
        } else {
            book.author
        };

        self.conn
            .execute(
                queries::UPSERT_BOOK,
                params![
                    book.book_hash,
                    book.title,
                    author,
                    format_str,
                    book.current_page,
                    book.total_pages,
                    book.percentage,
                    book.cover_image_url,
                    book.description,
                    book.page_offset_ratio,
                    book.last_read_at_ms,
                    book.updated_at_ms,
                ],
            )
            .map_err(to_err)?;

        Self::save_book_tags_and_author(
            &self.conn,
            &book.book_hash,
            &author,
            &book.tags,
            book.updated_at_ms,
        )
        .map_err(to_err)?;

        Ok(())
    }

    fn find_book_by_hash(&self, hash: &str) -> Result<Option<BookMetadata>, String> {
        let mut stmt = self
            .conn
            .prepare(queries::FIND_BOOK_BY_HASH)
            .map_err(to_err)?;
        let mut rows = stmt
            .query_map(params![hash], Self::row_to_book)
            .map_err(to_err)?;

        if let Some(row) = rows.next() {
            let mut book = row.map_err(to_err)?;
            book.tags = Self::load_tags_for_book(&self.conn, hash).map_err(to_err)?;
            Ok(Some(book))
        } else {
            Ok(None)
        }
    }

    fn list_books(&self) -> Result<Vec<BookMetadata>, String> {
        let mut stmt = self.conn.prepare(queries::LIST_BOOKS).map_err(to_err)?;
        let rows = stmt.query_map([], Self::row_to_book).map_err(to_err)?;

        let mut books = Vec::new();
        for r in rows {
            books.push(r.map_err(to_err)?);
        }

        let mut tag_stmt = self
            .conn
            .prepare(queries::LOAD_ALL_BOOK_TAGS)
            .map_err(to_err)?;
        let mut tag_rows = tag_stmt.query([]).map_err(to_err)?;
        let mut tags_by_hash: std::collections::HashMap<String, Vec<String>> =
            std::collections::HashMap::new();
        while let Some(row) = tag_rows.next().map_err(to_err)? {
            let hash: String = row.get(0).map_err(to_err)?;
            let tag: String = row.get(1).map_err(to_err)?;
            tags_by_hash.entry(hash).or_default().push(tag);
        }

        for book in &mut books {
            book.tags = tags_by_hash.remove(&book.book_hash).unwrap_or_default();
        }

        Ok(books)
    }

    fn delete_book(&mut self, hash: &str) -> Result<bool, String> {
        let count = self
            .conn
            .execute(queries::DELETE_BOOK, params![hash])
            .map_err(to_err)?;
        if count > 0 {
            Self::prune_orphaned_metadata(&self.conn).map_err(to_err)?;
        }
        Ok(count > 0)
    }

    fn update_book_metadata(
        &mut self,
        hash: &str,
        title: &str,
        author: &str,
        tags: &[String],
        description: Option<&str>,
    ) -> Result<BookMetadata, String> {
        let now_ms = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis() as i64)
            .unwrap_or(0);

        let safe_author = if author.trim().eq_ignore_ascii_case("local file") {
            "Unknown"
        } else {
            author
        };

        let rows_affected = self
            .conn
            .execute(
                queries::UPDATE_BOOK_METADATA,
                params![title, safe_author, description, now_ms, hash],
            )
            .map_err(to_err)?;

        if rows_affected == 0 {
            return Err(format!("Book not found: {hash}"));
        }

        Self::save_book_tags_and_author(&self.conn, hash, safe_author, tags, now_ms)
            .map_err(to_err)?;

        self.find_book_by_hash(hash)?
            .ok_or_else(|| format!("Book not found after update: {hash}"))
    }

    fn list_authors(&self) -> Result<Vec<String>, String> {
        let mut stmt = self.conn.prepare(queries::LIST_AUTHORS).map_err(to_err)?;
        let rows = stmt
            .query_map([], |r| r.get::<_, String>(0))
            .map_err(to_err)?;
        let mut authors = Vec::new();
        for a in rows {
            authors.push(a.map_err(to_err)?);
        }
        Ok(authors)
    }

    fn list_tags(&self) -> Result<Vec<String>, String> {
        let mut stmt = self.conn.prepare(queries::LIST_TAGS).map_err(to_err)?;
        let rows = stmt
            .query_map([], |r| r.get::<_, String>(0))
            .map_err(to_err)?;
        let mut tags = Vec::new();
        for t in rows {
            tags.push(t.map_err(to_err)?);
        }
        Ok(tags)
    }

    fn add_storage_location(&mut self, location: BookStorageLocation) -> Result<(), String> {
        self.conn
            .execute(
                queries::UPSERT_LOCATION,
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
        let mut stmt = self.conn.prepare(queries::GET_LOCATIONS).map_err(to_err)?;
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
            .execute(queries::DELETE_LOCATION, params![book_hash, provider_id])
            .map_err(to_err)?;
        Ok(count > 0)
    }
}
