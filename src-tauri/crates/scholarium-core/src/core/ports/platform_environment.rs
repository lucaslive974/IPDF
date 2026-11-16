use crate::core::domain::PlatformKind;
use std::path::PathBuf;

pub trait PlatformEnvironment {
    fn platform_kind(&self) -> PlatformKind;
    fn config_dir(&self) -> Result<PathBuf, String>;
    fn data_dir(&self) -> Result<PathBuf, String>;
    fn cache_dir(&self) -> Result<PathBuf, String>;

    fn books_dir(&self) -> Result<PathBuf, String> {
        Ok(self.data_dir()?.join(".books"))
    }

    fn covers_dir(&self) -> Result<PathBuf, String> {
        Ok(self.data_dir()?.join(".covers"))
    }

    fn log_dir(&self) -> Result<PathBuf, String> {
        Ok(self.data_dir()?.join(".logs"))
    }

    fn resolve_database_path(&self, db_name: &str) -> Result<PathBuf, String> {
        Ok(self.data_dir()?.join(".config").join(db_name))
    }

    fn resolve_highlights_path(&self, book_hash: &str) -> Result<PathBuf, String> {
        Ok(self
            .data_dir()?
            .join(".config")
            .join("highlights")
            .join(format!("{book_hash}.highlights.json")))
    }

    fn resolve_config_file_path(&self, file_name: &str) -> Result<PathBuf, String> {
        let cfg = self.config_dir()?;
        Ok(cfg.join(file_name))
    }
}
