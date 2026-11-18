import {
  formatBackupDeviceLabel,
  formatBackupPlatform,
  formatBackupSize,
  type UseBackupReturn,
  useBackup,
} from '@hooks/useBackup';
import type { BackupArtifact } from '@ports/IBackupService';
import { Badge, Button, Card } from '@ui';
import { memo } from 'react';

export interface SettingsBackupSectionProps {
  readonly state?: UseBackupReturn;
}

function formatBackupDate(createdAtMs: number): string {
  if (!createdAtMs) return 'Unknown date';
  return new Date(createdAtMs).toLocaleString();
}

interface BackupStatusBannersProps {
  readonly statusMessage: string | null;
  readonly error: string | null;
}

function BackupStatusBanners({ statusMessage, error }: BackupStatusBannersProps) {
  return (
    <>
      {statusMessage && (
        <div className="rounded-lg border border-line-subtle bg-surface-subtle p-3 text-xs text-tx-secondary">
          {statusMessage}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-500">
          {error}
        </div>
      )}
    </>
  );
}

interface BackupRestoreConfirmationProps {
  readonly isRestoring: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

function BackupRestoreConfirmation({
  isRestoring,
  onConfirm,
  onCancel,
}: BackupRestoreConfirmationProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-md border border-line-strong bg-surface p-2.5">
      <span className="text-xs text-tx-secondary">
        Restore this snapshot? Current local books and highlights will be replaced.
      </span>
      <div className="flex items-center gap-2">
        <Button variant="danger" size="xs" disabled={isRestoring} onClick={onConfirm}>
          {isRestoring ? 'Restoring…' : 'Confirm Restore'}
        </Button>
        <Button variant="outline" size="xs" disabled={isRestoring} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

interface BackupArtifactRowProps {
  readonly backup: BackupArtifact;
  readonly isConfirming: boolean;
  readonly isBusy: boolean;
  readonly isRestoring: boolean;
  readonly onRequestRestore: (backupId: string) => void;
  readonly onConfirmRestore: (backupId: string) => void;
  readonly onCancelRestore: () => void;
  readonly onDelete: (backupId: string) => void;
}

function BackupArtifactRow({
  backup,
  isConfirming,
  isBusy,
  isRestoring,
  onRequestRestore,
  onConfirmRestore,
  onCancelRestore,
  onDelete,
}: BackupArtifactRowProps) {
  return (
    <Card variant="subtle" padding="sm" rounded="lg" className="flex flex-col gap-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium leading-none text-tx-main">
              {formatBackupDeviceLabel(backup.deviceLabel)}
            </span>
            <Badge variant="brand" size="xs">
              {formatBackupPlatform(backup.platform)}
            </Badge>
          </div>
          <span className="truncate text-xs text-tx-muted" title={backup.name}>
            {formatBackupDate(backup.createdAtMs)} · {formatBackupSize(backup.sizeBytes)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="xs"
            disabled={isBusy}
            onClick={() => onRequestRestore(backup.id)}
          >
            Restore
          </Button>
          <Button
            variant="danger-subtle"
            size="xs"
            disabled={isBusy}
            onClick={() => onDelete(backup.id)}
          >
            Delete
          </Button>
        </div>
      </div>

      {isConfirming && (
        <BackupRestoreConfirmation
          isRestoring={isRestoring}
          onConfirm={() => onConfirmRestore(backup.id)}
          onCancel={onCancelRestore}
        />
      )}
    </Card>
  );
}

export const SettingsBackupSection = memo(function SettingsBackupSection({
  state: injectedState,
}: SettingsBackupSectionProps) {
  const hookState = useBackup();
  const {
    backups,
    isLoading,
    isCreating,
    isRestoring,
    pendingRestoreId,
    statusMessage,
    error,
    createBackup,
    exportBackup,
    importBackup,
    requestRestore,
    cancelRestore,
    confirmRestore,
    deleteBackup,
  } = injectedState ?? hookState;

  const isBusy = isCreating || isRestoring;

  return (
    <Card variant="surface" padding="md" className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-tx-muted">Backups</h2>
          <p className="mt-1 text-xs text-tx-secondary">
            Create and restore full local snapshots of your books, covers, database, and highlights:
          </p>
        </div>
        <Button variant="primary" size="sm" disabled={isBusy} onClick={() => void createBackup()}>
          {isCreating ? 'Creating…' : 'Create Backup'}
        </Button>
      </div>

      <BackupStatusBanners statusMessage={statusMessage} error={error} />

      {isLoading && backups.length === 0 ? (
        <p className="text-xs text-tx-muted">Loading local backups…</p>
      ) : backups.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line-subtle p-4 text-center text-xs text-tx-muted">
          No local backups yet. Create a snapshot to protect your library.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {backups.map((backup) => (
            <BackupArtifactRow
              key={backup.id}
              backup={backup}
              isConfirming={pendingRestoreId === backup.id}
              isBusy={isBusy}
              isRestoring={isRestoring}
              onRequestRestore={requestRestore}
              onConfirmRestore={(id) => void confirmRestore(id)}
              onCancelRestore={cancelRestore}
              onDelete={(id) => void deleteBackup(id)}
            />
          ))}
        </div>
      )}
    </Card>
  );
});
