#[cfg(feature = "cloud-sync")]
pub mod commands;
#[cfg(not(feature = "cloud-sync"))]
#[path = "noop_commands.rs"]
pub mod commands;
#[cfg(feature = "cloud-sync")]
mod enabled;
#[cfg(not(feature = "cloud-sync"))]
mod noop;
#[cfg(all(
    feature = "cloud-sync",
    not(any(target_os = "android", target_os = "ios"))
))]
pub mod oauth_loopback;

#[cfg(feature = "cloud-sync")]
pub use enabled::{configure, remote_backup_destination, CloudSyncState, PendingGoogleOAuth};
#[cfg(not(feature = "cloud-sync"))]
pub use noop::{configure, remote_backup_destination, CloudSyncState};
