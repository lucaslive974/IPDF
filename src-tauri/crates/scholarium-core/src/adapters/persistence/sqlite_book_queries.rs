pub const PRAGMA_FOREIGN_KEYS_ON: &str = "PRAGMA foreign_keys = ON;";

pub const CREATE_BOOKS_TABLE: &str = "
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
        page_offset_ratio REAL NOT NULL DEFAULT 0.0,
        last_read_at_ms INTEGER NOT NULL,
        updated_at_ms INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_books_last_read
        ON books (last_read_at_ms DESC);
";

pub const MIGRATION_ADD_PAGE_OFFSET_RATIO: &str =
    "ALTER TABLE books ADD COLUMN page_offset_ratio REAL NOT NULL DEFAULT 0.0;";

pub const MIGRATION_SET_DEFAULT_PAGE_OFFSET_RATIO: &str =
    "UPDATE books SET page_offset_ratio = 0.0 WHERE page_offset_ratio IS NULL;";

pub const CREATE_LOCATIONS_TABLE: &str = "
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

pub const CREATE_AUTHORS_TAGS_TABLES: &str = "
    CREATE TABLE IF NOT EXISTS authors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE COLLATE NOCASE,
        created_at_ms INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_authors_name ON authors(name);

    CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE COLLATE NOCASE
    );
    CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);

    CREATE TABLE IF NOT EXISTS book_tags (
        book_hash TEXT NOT NULL,
        tag_id INTEGER NOT NULL,
        PRIMARY KEY (book_hash, tag_id),
        FOREIGN KEY (book_hash) REFERENCES books(hash) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_book_tags_hash ON book_tags(book_hash);
    CREATE INDEX IF NOT EXISTS idx_book_tags_tag_id ON book_tags(tag_id);
";

pub const MIGRATION_NORMALIZE_UNKNOWN_AUTHOR: &str =
    "UPDATE books SET author = 'Unknown' WHERE LOWER(TRIM(author)) = 'local file';";

pub const PRUNE_ORPHANED_TAGS: &str =
    "DELETE FROM tags WHERE id NOT IN (SELECT DISTINCT tag_id FROM book_tags);";

pub const PRUNE_ORPHANED_AUTHORS: &str = "
    DELETE FROM authors WHERE LOWER(TRIM(name)) IN ('unknown', 'unknown author', 'local file', '')
     OR name NOT IN (SELECT DISTINCT author FROM books WHERE TRIM(author) != '');
";

pub const INSERT_AUTHOR: &str =
    "INSERT OR IGNORE INTO authors (name, created_at_ms) VALUES (?1, ?2);";

pub const DELETE_BOOK_TAGS: &str = "DELETE FROM book_tags WHERE book_hash = ?1;";

pub const INSERT_TAG: &str = "INSERT OR IGNORE INTO tags (name) VALUES (?1);";

pub const FIND_TAG_ID_BY_NAME: &str = "SELECT id FROM tags WHERE name = ?1 COLLATE NOCASE;";

pub const INSERT_BOOK_TAG: &str =
    "INSERT OR IGNORE INTO book_tags (book_hash, tag_id) VALUES (?1, ?2);";

pub const LOAD_TAGS_FOR_BOOK: &str = "
    SELECT t.name FROM tags t
    JOIN book_tags bt ON t.id = bt.tag_id
    WHERE bt.book_hash = ?1
    ORDER BY t.name COLLATE NOCASE ASC;
";

pub const UPSERT_BOOK: &str = "
    INSERT OR REPLACE INTO books (
        hash, title, author, format, current_page, total_pages,
        percentage, cover_image_url, description, page_offset_ratio,
        last_read_at_ms, updated_at_ms
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12);
";

pub const FIND_BOOK_BY_HASH: &str = "
    SELECT hash, title, author, format, current_page, total_pages,
           percentage, cover_image_url, description, page_offset_ratio,
           last_read_at_ms, updated_at_ms
    FROM books WHERE hash = ?1;
";

pub const LIST_BOOKS: &str = "
    SELECT hash, title, author, format, current_page, total_pages,
           percentage, cover_image_url, description, page_offset_ratio,
           last_read_at_ms, updated_at_ms
    FROM books ORDER BY last_read_at_ms DESC;
";

pub const LOAD_ALL_BOOK_TAGS: &str = "
    SELECT bt.book_hash, t.name
    FROM book_tags bt
    JOIN tags t ON t.id = bt.tag_id
    ORDER BY t.name COLLATE NOCASE ASC;
";

pub const DELETE_BOOK: &str = "DELETE FROM books WHERE hash = ?1;";

pub const UPDATE_BOOK_METADATA: &str = "
    UPDATE books SET title = ?1, author = ?2, description = ?3, updated_at_ms = ?4 WHERE hash = ?5;
";

pub const LIST_AUTHORS: &str = "
    SELECT name FROM authors WHERE LOWER(TRIM(name)) NOT IN ('unknown', 'unknown author', 'local file', '') ORDER BY name COLLATE NOCASE ASC;
";

pub const LIST_TAGS: &str = "SELECT name FROM tags ORDER BY name COLLATE NOCASE ASC;";

pub const UPSERT_LOCATION: &str = "
    INSERT OR REPLACE INTO book_storage_locations (
        book_hash, provider_id, storage_path, is_downloaded, last_synced_at_ms
    ) VALUES (?1, ?2, ?3, ?4, ?5);
";

pub const GET_LOCATIONS: &str = "
    SELECT book_hash, provider_id, storage_path, is_downloaded, last_synced_at_ms
    FROM book_storage_locations WHERE book_hash = ?1;
";

pub const DELETE_LOCATION: &str = "
    DELETE FROM book_storage_locations WHERE book_hash = ?1 AND provider_id = ?2;
";
