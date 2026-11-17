import type {
  BackupArtifact,
  BackupReport,
  CreateBackupResult,
  IBackupService,
} from '@ports/IBackupService';
import { invoke } from '@tauri-apps/api/core';

export class TauriBackupService implements IBackupService {
  public async createLocalBackup(): Promise<CreateBackupResult> {
    return invoke<CreateBackupResult>('create_local_backup');
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
}
