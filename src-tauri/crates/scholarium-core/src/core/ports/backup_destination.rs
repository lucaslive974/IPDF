use serde::{Deserialize, Serialize};

const BACKUP_PREFIX: &str = "scholarium-backup-";
const BACKUP_EXT: &str = ".zip";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupArtifact {
    pub id: String,
    pub name: String,
    pub device_label: String,
    pub platform: String,
    pub size_bytes: u64,
    pub created_at_ms: i64,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupReport {
    pub books_count: usize,
    pub covers_count: usize,
    pub includes_database: bool,
    pub total_bytes: u64,
}

pub fn format_backup_filename(device_label: &str, platform: &str, timestamp_ms: i64) -> String {
    format!("{BACKUP_PREFIX}{device_label}-{platform}-{timestamp_ms}{BACKUP_EXT}")
}

/// Parses `scholarium-backup-<device_label>-<platform>-<timestamp_ms>.zip`.
pub fn parse_backup_filename(name: &str) -> Option<(String, String, i64)> {
    let inner = name.strip_prefix(BACKUP_PREFIX)?.strip_suffix(BACKUP_EXT)?;
    let mut parts = inner.splitn(3, '-');
    let device_label = parts.next()?.to_string();
    let platform = parts.next()?.to_string();
    let timestamp_ms = parts.next()?.parse::<i64>().ok()?;
    Some((device_label, platform, timestamp_ms))
}

pub trait BackupDestination: Send + Sync {
    fn save_backup(&self, name: &str, data: &[u8]) -> Result<BackupArtifact, String>;
    fn list_backups(&self) -> Result<Vec<BackupArtifact>, String>;
    fn load_backup(&self, id: &str) -> Result<Vec<u8>, String>;
    fn delete_backup(&self, id: &str) -> Result<bool, String>;
}
