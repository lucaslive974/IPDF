use crate::core::ports::{
    parse_backup_filename, BackupArtifact, BackupDestination, BackupLocation,
};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

/// Filesystem-backed `BackupDestination` storing `.zip` snapshots in a dedicated backup directory.
pub struct LocalBackupDestination {
    backup_dir: PathBuf,
}

impl LocalBackupDestination {
    pub fn new(backup_dir: PathBuf) -> Self {
        Self { backup_dir }
    }

    pub fn backup_dir(&self) -> &Path {
        &self.backup_dir
    }

    fn resolve_safe_path(&self, id: &str) -> Result<PathBuf, String> {
        if id.is_empty() || id.contains('/') || id.contains('\\') || id.contains("..") {
            return Err(format!("Invalid backup identifier: {id}"));
        }
        Ok(self.backup_dir.join(id))
    }

    fn build_artifact(&self, name: String, size_bytes: u64, fallback_ms: i64) -> BackupArtifact {
        let (device_label, platform, created_at_ms) = parse_backup_filename(&name)
            .unwrap_or_else(|| ("unknown".to_string(), "unknown".to_string(), fallback_ms));

        BackupArtifact {
            id: name.clone(),
            name,
            device_label,
            platform,
            size_bytes,
            created_at_ms,
            location: BackupLocation::Local,
        }
    }
}

impl BackupDestination for LocalBackupDestination {
    fn save_backup(&self, name: &str, data: &[u8]) -> Result<BackupArtifact, String> {
        fs::create_dir_all(&self.backup_dir).map_err(|e| e.to_string())?;
        let safe_path = self.resolve_safe_path(name)?;
        fs::write(&safe_path, data).map_err(|e| e.to_string())?;

        let fallback_ms = fs::metadata(&safe_path)
            .ok()
            .and_then(|m| m.modified().ok())
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as i64)
            .unwrap_or(0);

        Ok(self.build_artifact(name.to_string(), data.len() as u64, fallback_ms))
    }

    fn list_backups(&self) -> Result<Vec<BackupArtifact>, String> {
        if !self.backup_dir.exists() {
            return Ok(Vec::new());
        }

        let mut artifacts = Vec::new();
        for entry in fs::read_dir(&self.backup_dir).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            if !path.is_file() {
                continue;
            }
            let name = entry.file_name().to_string_lossy().to_string();
            if !name.ends_with(".zip") {
                continue;
            }
            let meta = entry.metadata().map_err(|e| e.to_string())?;
            let fallback_ms = meta
                .modified()
                .ok()
                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                .map(|d| d.as_millis() as i64)
                .unwrap_or(0);

            artifacts.push(self.build_artifact(name, meta.len(), fallback_ms));
        }

        artifacts.sort_by_key(|a| std::cmp::Reverse(a.created_at_ms));
        Ok(artifacts)
    }

    fn load_backup(&self, id: &str) -> Result<Vec<u8>, String> {
        let path = self.resolve_safe_path(id)?;
        if !path.is_file() {
            return Err(format!("Backup not found: {id}"));
        }
        fs::read(&path).map_err(|e| e.to_string())
    }

    fn delete_backup(&self, id: &str) -> Result<bool, String> {
        let path = self.resolve_safe_path(id)?;
        if !path.is_file() {
            return Ok(false);
        }
        fs::remove_file(&path).map_err(|e| e.to_string())?;
        Ok(true)
    }
}
