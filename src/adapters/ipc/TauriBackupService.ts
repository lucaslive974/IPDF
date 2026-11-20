import type {
  BackupArtifact,
  BackupReport,
  CreateBackupResult,
  IBackupService,
} from '@ports/IBackupService';
import { invoke } from '@tauri-apps/api/core';

export class TauriBackupService implements IBackupService {
  public async createLocalBackup(uploadToCloud?: boolean): Promise<CreateBackupResult> {
    return invoke<CreateBackupResult>('create_local_backup', {
      uploadToCloud: uploadToCloud ?? false,
    });
  }

  public async listLocalBackups(): Promise<BackupArtifact[]> {
    return invoke<BackupArtifact[]>('list_local_backups');
  }

  public async restoreLocalBackup(backupId: string): Promise<BackupReport> {
    return invoke<BackupReport>('restore_local_backup', { backupId });
  }

  public async deleteLocalBackup(backupId: string): Promise<boolean> {
    return invoke<boolean>('delete_local_backup', { backupId });
  }

  public async uploadBackupToCloud(backupId: string): Promise<BackupArtifact> {
    return invoke<BackupArtifact>('upload_backup_to_cloud', { backupId });
  }

  public async deleteRemoteBackup(backupId: string): Promise<boolean> {
    return invoke<boolean>('delete_remote_backup', { backupId });
  }

  public async exportLocalBackup(backupId: string): Promise<string | null> {
    return invoke<string | null>('export_local_backup', { backupId });
  }

  public async importAndRestoreBackup(uploadToCloud?: boolean): Promise<BackupReport | null> {
    return invoke<BackupReport | null>('import_and_restore_backup', {
      uploadToCloud: uploadToCloud ?? false,
    });
  }
}
