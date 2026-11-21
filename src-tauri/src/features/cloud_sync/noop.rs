use crate::state::{AppStorage, BackendState};
use scholarium_core::core::ports::{BackupDestination, PlatformEnvironment};
use std::sync::Arc;

#[derive(Default)]
pub struct CloudSyncState;

impl CloudSyncState {
    pub fn init(_platform: &dyn PlatformEnvironment, _storage: &mut AppStorage) -> Self {
        Self
    }

    #[inline]
    pub fn mark_dirty(&self) {}
}

pub fn configure(
    builder: tauri::Builder<tauri::Wry>,
    _backend_state: &BackendState,
) -> tauri::Builder<tauri::Wry> {
    builder
}

pub fn remote_backup_destination(_storage: &AppStorage) -> Option<Arc<dyn BackupDestination>> {
    None
}
