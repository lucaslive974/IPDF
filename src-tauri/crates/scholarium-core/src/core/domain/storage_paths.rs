/// Canonical relative directory and file names used across Scholarium's local data layout.
/// Centralizes all storage paths in a single source of truth.
pub struct AppStoragePaths;

impl AppStoragePaths {
    pub const BOOKS_DIR: &'static str = ".books";
    pub const COVERS_DIR: &'static str = ".covers";
    pub const CONFIG_DIR: &'static str = ".config";
    pub const LOGS_DIR: &'static str = ".logs";
    pub const BACKUPS_DIR: &'static str = "backups";
    pub const HIGHLIGHTS_SUBDIR: &'static str = "highlights";
    pub const DATABASE_FILENAME: &'static str = "scholarium.db";
    pub const LOG_FILE_PREFIX: &'static str = "scholarium.log";

    pub fn cover_entry_name(book_hash: &str, ext: &str) -> String {
        format!("{}/{book_hash}.{ext}", Self::COVERS_DIR)
    }

    pub fn database_relative_path() -> String {
        format!("{}/{}", Self::CONFIG_DIR, Self::DATABASE_FILENAME)
    }

    pub fn highlights_relative_dir() -> String {
        format!("{}/{}", Self::CONFIG_DIR, Self::HIGHLIGHTS_SUBDIR)
    }
}
