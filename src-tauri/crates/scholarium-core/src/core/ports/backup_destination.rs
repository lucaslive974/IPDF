use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupArtifact {
    pub id: String,
    pub name: String,
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

pub trait BackupDestination: Send + Sync {
    fn save_backup(&self, name: &str, data: &[u8]) -> Result<BackupArtifact, String>;
    fn list_backups(&self) -> Result<Vec<BackupArtifact>, String>;
    fn load_backup(&self, id: &str) -> Result<Vec<u8>, String>;
    fn delete_backup(&self, id: &str) -> Result<bool, String>;
}
