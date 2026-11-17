export interface BackupArtifact {
  readonly id: string;
  readonly name: string;
  readonly sizeBytes: number;
  readonly createdAtMs: number;
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
  createLocalBackup(): Promise<CreateBackupResult>;
  listLocalBackups(): Promise<BackupArtifact[]>;
  restoreLocalBackup(backupId: string): Promise<BackupReport>;
  deleteLocalBackup(backupId: string): Promise<boolean>;
}
