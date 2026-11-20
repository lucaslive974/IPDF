export type BackupLocation = 'local' | 'remote' | 'both';

export interface BackupArtifact {
  readonly id: string;
  readonly name: string;
  readonly deviceLabel: string;
  readonly platform: string;
  readonly sizeBytes: number;
  readonly createdAtMs: number;
  readonly location?: BackupLocation;
}

export interface BackupReport {
  readonly booksCount: number;
  readonly coversCount: number;
  readonly includesDatabase: boolean;
  readonly totalBytes: number;
}

export interface CreateBackupResult {
  readonly artifact: BackupArtifact;
  readonly report: BackupReport;
}

export interface IBackupService {
  createLocalBackup(uploadToCloud?: boolean): Promise<CreateBackupResult>;
  listLocalBackups(): Promise<BackupArtifact[]>;
  restoreLocalBackup(backupId: string): Promise<BackupReport>;
  deleteLocalBackup(backupId: string): Promise<boolean>;
  uploadBackupToCloud(backupId: string): Promise<BackupArtifact>;
  deleteRemoteBackup(backupId: string): Promise<boolean>;
  exportLocalBackup(backupId: string): Promise<string | null>;
  importAndRestoreBackup(uploadToCloud?: boolean): Promise<BackupReport | null>;
}
