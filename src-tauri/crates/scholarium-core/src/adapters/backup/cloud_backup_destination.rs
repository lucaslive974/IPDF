use crate::core::ports::{
    parse_backup_filename, BackupArtifact, BackupDestination, BackupLocation, CloudStorageProvider,
};
use std::sync::Arc;

const REMOTE_BACKUP_PREFIX: &str = "backups/";

/// `BackupDestination` backed by any `CloudStorageProvider` (e.g. Google Drive `appDataFolder`).
pub struct CloudBackupDestination {
    cloud: Arc<dyn CloudStorageProvider>,
}

impl CloudBackupDestination {
    pub fn new(cloud: Arc<dyn CloudStorageProvider>) -> Self {
        Self { cloud }
    }

    fn remote_path(id: &str) -> Result<String, String> {
        if id.is_empty() || id.contains('/') || id.contains('\\') || id.contains("..") {
            return Err(format!("Invalid backup identifier: {id}"));
        }
        Ok(format!("{REMOTE_BACKUP_PREFIX}{id}"))
    }

    fn build_artifact(name: String, size_bytes: u64) -> BackupArtifact {
        let (device_label, platform, created_at_ms) = parse_backup_filename(&name)
            .unwrap_or_else(|| ("unknown".to_string(), "unknown".to_string(), 0));

        BackupArtifact {
            id: name.clone(),
            name,
            device_label,
            platform,
            size_bytes,
            created_at_ms,
            location: BackupLocation::Remote,
        }
    }
}

impl BackupDestination for CloudBackupDestination {
    fn save_backup(&self, name: &str, data: &[u8]) -> Result<BackupArtifact, String> {
        let path = Self::remote_path(name)?;
        self.cloud
            .write_unconditional(&path, data, "application/zip")
            .map_err(|e| e.to_string())?;
        Ok(Self::build_artifact(name.to_string(), data.len() as u64))
    }

    fn list_backups(&self) -> Result<Vec<BackupArtifact>, String> {
        let objects = self
            .cloud
            .list_prefix(REMOTE_BACKUP_PREFIX)
            .map_err(|e| e.to_string())?;

        let mut artifacts: Vec<BackupArtifact> = objects
            .into_iter()
            .filter_map(|meta| {
                let filename = meta
                    .path
                    .strip_prefix(REMOTE_BACKUP_PREFIX)
                    .unwrap_or(&meta.path);
                if !filename.ends_with(".zip") || filename.contains('/') {
                    return None;
                }
                Some(Self::build_artifact(filename.to_string(), meta.size_bytes))
            })
            .collect();

        artifacts.sort_by(|a, b| b.created_at_ms.cmp(&a.created_at_ms));
        Ok(artifacts)
    }

    fn load_backup(&self, id: &str) -> Result<Vec<u8>, String> {
        let path = Self::remote_path(id)?;
        let Some((bytes, _meta)) = self.cloud.read(&path).map_err(|e| e.to_string())? else {
            return Err(format!("Remote backup not found: {id}"));
        };
        Ok(bytes)
    }

    fn delete_backup(&self, id: &str) -> Result<bool, String> {
        let path = Self::remote_path(id)?;
        self.cloud
            .delete_unconditional(&path)
            .map_err(|e| e.to_string())?;
        Ok(true)
    }
}
