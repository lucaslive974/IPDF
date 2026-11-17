use crate::core::domain::{AppStoragePaths, PlatformKind};
use std::path::PathBuf;

pub trait PlatformEnvironment {
    fn platform_kind(&self) -> PlatformKind;
    fn config_dir(&self) -> Result<PathBuf, String>;
    fn data_dir(&self) -> Result<PathBuf, String>;
    fn cache_dir(&self) -> Result<PathBuf, String>;

    fn books_dir(&self) -> Result<PathBuf, String> {
        Ok(self.data_dir()?.join(AppStoragePaths::BOOKS_DIR))
    }

    fn covers_dir(&self) -> Result<PathBuf, String> {
        Ok(self.data_dir()?.join(AppStoragePaths::COVERS_DIR))
    }

    fn log_dir(&self) -> Result<PathBuf, String> {
        Ok(self.data_dir()?.join(AppStoragePaths::LOGS_DIR))
    }

    fn backups_dir(&self) -> Result<PathBuf, String> {
        Ok(self.data_dir()?.join(AppStoragePaths::BACKUPS_DIR))
    }

    fn highlights_dir(&self) -> Result<PathBuf, String> {
        Ok(self
            .data_dir()?
            .join(AppStoragePaths::CONFIG_DIR)
            .join(AppStoragePaths::HIGHLIGHTS_SUBDIR))
    }

    fn resolve_database_path(&self, db_name: &str) -> Result<PathBuf, String> {
        Ok(self
            .data_dir()?
            .join(AppStoragePaths::CONFIG_DIR)
            .join(db_name))
    }

    fn default_database_path(&self) -> Result<PathBuf, String> {
        self.resolve_database_path(AppStoragePaths::DATABASE_FILENAME)
    }

    fn resolve_highlights_path(&self, book_hash: &str) -> Result<PathBuf, String> {
        Ok(self
            .highlights_dir()?
            .join(format!("{book_hash}.highlights.json")))
    }

    fn resolve_config_file_path(&self, file_name: &str) -> Result<PathBuf, String> {
        let cfg = self.config_dir()?;
        Ok(cfg.join(file_name))
    }
}
