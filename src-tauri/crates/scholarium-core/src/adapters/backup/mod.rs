pub mod cloud_backup_destination;
pub mod hybrid_backup_destination;
pub mod local_backup_destination;

pub use cloud_backup_destination::CloudBackupDestination;
pub use hybrid_backup_destination::HybridBackupDestination;
pub use local_backup_destination::LocalBackupDestination;
