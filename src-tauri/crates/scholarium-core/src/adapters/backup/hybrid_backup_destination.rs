use crate::core::ports::{BackupArtifact, BackupDestination, BackupLocation};
use std::collections::BTreeMap;
use std::sync::Arc;

/// Decorator combining a local `BackupDestination` with an optional remote `BackupDestination`.
///
/// Local backups are always written locally by default; remote uploads and deletions are explicit.
/// Listing merges local and remote entries by backup `id`, tagging `Local`, `Remote`, or `Both`.
pub struct HybridBackupDestination<L: BackupDestination> {
    local: L,
    remote: Option<Arc<dyn BackupDestination>>,
}

impl<L: BackupDestination> HybridBackupDestination<L> {
    pub fn new(local: L, remote: Option<Arc<dyn BackupDestination>>) -> Self {
        Self { local, remote }
    }

    pub fn local(&self) -> &L {
        &self.local
    }

    pub fn remote(&self) -> Option<&Arc<dyn BackupDestination>> {
        self.remote.as_ref()
    }

    /// Explicitly uploads an existing local backup to the remote destination.
    pub fn upload_local_to_remote(&self, id: &str) -> Result<BackupArtifact, String> {
        let remote = self
            .remote
            .as_ref()
            .ok_or_else(|| "No cloud provider connected".to_string())?;
        let bytes = self.local.load_backup(id)?;
        let mut artifact = remote.save_backup(id, &bytes)?;
        artifact.location = BackupLocation::Both;
        Ok(artifact)
    }

    /// Explicitly deletes a backup from the remote destination only.
    pub fn delete_remote(&self, id: &str) -> Result<bool, String> {
        let remote = self
            .remote
            .as_ref()
            .ok_or_else(|| "No cloud provider connected".to_string())?;
        remote.delete_backup(id)
    }
}

impl<L: BackupDestination> BackupDestination for HybridBackupDestination<L> {
    fn save_backup(&self, name: &str, data: &[u8]) -> Result<BackupArtifact, String> {
        self.local.save_backup(name, data)
    }

    fn list_backups(&self) -> Result<Vec<BackupArtifact>, String> {
        let local_items = self.local.list_backups()?;
        let mut merged: BTreeMap<String, BackupArtifact> = local_items
            .into_iter()
            .map(|item| (item.id.clone(), item))
            .collect();

        if let Some(ref remote) = self.remote {
            if let Ok(remote_items) = remote.list_backups() {
                for item in remote_items {
                    if let Some(existing) = merged.get_mut(&item.id) {
                        existing.location = BackupLocation::Both;
                    } else {
                        merged.insert(item.id.clone(), item);
                    }
                }
            }
        }

        let mut artifacts: Vec<BackupArtifact> = merged.into_values().collect();
        artifacts.sort_by(|a, b| b.created_at_ms.cmp(&a.created_at_ms));
        Ok(artifacts)
    }

    fn load_backup(&self, id: &str) -> Result<Vec<u8>, String> {
        match self.local.load_backup(id) {
            Ok(bytes) => Ok(bytes),
            Err(local_err) => {
                if let Some(ref remote) = self.remote {
                    remote.load_backup(id)
                } else {
                    Err(local_err)
                }
            }
        }
    }

    fn delete_backup(&self, id: &str) -> Result<bool, String> {
        self.local.delete_backup(id)
    }
}
