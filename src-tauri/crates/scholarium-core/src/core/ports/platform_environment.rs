use crate::core::domain::{AppStoragePaths, PlatformKind};
use std::path::PathBuf;

/// Sanitizes a device label into lowercase `[a-z0-9_]` characters so `-` remains an unambiguous
/// delimiter in backup filenames across all desktop and mobile filesystems.
pub fn sanitize_device_label(raw: &str, fallback: &str) -> String {
    let mut out = String::with_capacity(raw.len());
    let mut prev_underscore = false;

    for ch in raw.trim().chars() {
        if ch.is_ascii_alphanumeric() {
            out.push(ch.to_ascii_lowercase());
            prev_underscore = false;
        } else if !prev_underscore && !out.is_empty() {
            out.push('_');
            prev_underscore = true;
        }
    }

    let trimmed = out.trim_matches('_');
    if trimmed.is_empty() {
        fallback.to_string()
    } else {
        trimmed.to_string()
    }
}

pub trait PlatformEnvironment {
    fn platform_kind(&self) -> PlatformKind;
    fn config_dir(&self) -> Result<PathBuf, String>;
    fn data_dir(&self) -> Result<PathBuf, String>;
    fn cache_dir(&self) -> Result<PathBuf, String>;

    fn device_label(&self) -> String {
        match self.platform_kind() {
            PlatformKind::Android => "android_device".to_string(),
            PlatformKind::Ios => "ios_device".to_string(),
            PlatformKind::Linux | PlatformKind::Windows => {
                let raw = std::env::var("HOSTNAME")
                    .or_else(|_| std::env::var("COMPUTERNAME"))
                    .unwrap_or_default();
                sanitize_device_label(&raw, "desktop")
            }
        }
    }

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
