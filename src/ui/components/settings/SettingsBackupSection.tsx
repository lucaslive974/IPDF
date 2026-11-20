import {
  formatBackupDeviceLabel,
  formatBackupPlatform,
  formatBackupSize,
  type UseBackupReturn,
  useBackup,
} from '@hooks/useBackup';
import type { BackupArtifact, BackupLocation } from '@ports/IBackupService';
import { useSyncStore } from '@stores/useSyncStore';
import { Badge, Button, Card } from '@ui';
import { memo } from 'react';

export interface SettingsBackupSectionProps {
  readonly state?: UseBackupReturn;
  readonly isCloudConnected?: boolean;
}

function resolveLocationBadge(location?: BackupLocation): {
  readonly label: string;
  readonly variant: 'faint' | 'brand';
} {
  if (location === 'remote') {
    return { label: 'Remote', variant: 'brand' };
  }
  if (location === 'both') {
    return { label: 'Local + Cloud', variant: 'brand' };
  }
  return { label: 'Local', variant: 'faint' };
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
  readonly isCloudConnected: boolean;
  readonly isConfirming: boolean;
  readonly isBusy: boolean;
  readonly isRestoring: boolean;
  readonly isUploading: boolean;
  readonly isExporting: boolean;
  readonly isDeleting: boolean;
  readonly onRequestRestore: (backupId: string) => void;
  readonly onConfirmRestore: (backupId: string) => void;
  readonly onCancelRestore: () => void;
  readonly onUploadToCloud: (backupId: string) => void;
  readonly onDeleteRemote: (backupId: string) => void;
  readonly onExport: (backupId: string) => void;
  readonly onDelete: (backupId: string) => void;
}

function BackupArtifactRow({
  backup,
  isCloudConnected,
  isConfirming,
  isBusy,
  isRestoring,
  isUploading,
  isExporting,
  isDeleting,
  onRequestRestore,
  onConfirmRestore,
  onCancelRestore,
  onUploadToCloud,
  onDeleteRemote,
  onExport,
  onDelete,
}: BackupArtifactRowProps) {
  const location = backup.location ?? 'local';
  const locationBadge = resolveLocationBadge(location);
  const canUpload = __ENABLE_CLOUD_SYNC__ && isCloudConnected && location === 'local';
  const canRemoveRemote = __ENABLE_CLOUD_SYNC__ && isCloudConnected && location === 'both';

  return (
    <Card variant="subtle" padding="sm" rounded="lg" className="flex flex-col gap-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-medium leading-none text-tx-main">
              {formatBackupDeviceLabel(backup.deviceLabel)}
            </span>
            <Badge variant="brand" size="xs">
              {formatBackupPlatform(backup.platform)}
            </Badge>
            <Badge variant={locationBadge.variant} size="xs">
              {locationBadge.label}
            </Badge>
          </div>
          <span className="truncate text-xs text-tx-muted" title={backup.name}>
            {formatBackupDate(backup.createdAtMs)} · {formatBackupSize(backup.sizeBytes)}
          </span>
        </div>

        <div className="flex flex-wrap shrink-0 items-center gap-2">
          {canUpload && (
            <Button
              variant="outline"
              size="xs"
              disabled={isBusy || isUploading}
              onClick={() => onUploadToCloud(backup.id)}
            >
              {isUploading ? 'Uploading…' : 'Upload to Cloud'}
            </Button>
          )}
          {canRemoveRemote && (
            <Button
              variant="outline"
              size="xs"
              disabled={isBusy || isUploading || isDeleting}
              onClick={() => onDeleteRemote(backup.id)}
            >
              {isDeleting ? 'Removing…' : 'Remove from Cloud'}
            </Button>
          )}
          <Button
            variant="outline"
            size="xs"
            disabled={isBusy || isExporting || isDeleting}
            onClick={() => onExport(backup.id)}
          >
            {isExporting ? 'Exporting…' : 'Save As…'}
          </Button>
          <Button
            variant="outline"
            size="xs"
            disabled={isBusy || isExporting || isDeleting}
            onClick={() => onRequestRestore(backup.id)}
          >
            Restore
          </Button>
          <Button
            variant="danger-subtle"
            size="xs"
            disabled={isBusy || isDeleting}
            onClick={() =>
              location === 'remote' ? onDeleteRemote(backup.id) : onDelete(backup.id)
            }
          >
            {isDeleting ? 'Deleting…' : 'Delete'}
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
  isCloudConnected: propCloudConnected,
}: SettingsBackupSectionProps) {
  const hookState = useBackup();
  const storeCloudConnected = useSyncStore((s) =>
    __ENABLE_CLOUD_SYNC__ ? Boolean(s.status?.connected) : false
  );
  const isCloudConnected = propCloudConnected ?? storeCloudConnected;

  const {
    backups,
    isLoading,
    isCreating,
    isRestoring,
    uploadingBackupId,
    exportingBackupId,
    deletingBackupId,
    uploadToCloud,
    pendingRestoreId,
    statusMessage,
    error,
    setUploadToCloud,
    createBackup,
    exportBackup,
    importBackup,
    requestRestore,
    cancelRestore,
    confirmRestore,
    deleteBackup,
    uploadBackupToCloud,
    deleteRemoteBackup,
  } = injectedState ?? hookState;

  const isBusy = isCreating || isRestoring;

  return (
    <Card variant="surface" padding="md" className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-tx-muted">
              Backups
            </h2>
            {isLoading && backups.length > 0 && (
              <span className="text-[0.68rem] text-tx-muted animate-pulse">Refreshing…</span>
            )}
          </div>
          <p className="mt-1 text-xs text-tx-secondary">
            Create and restore full snapshots of your books, covers, database, and highlights:
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="whitespace-nowrap"
            disabled={isBusy}
            onClick={() => void importBackup()}
          >
            Import Backup…
          </Button>
          <Button
            variant="primary"
            size="sm"
            className="whitespace-nowrap"
            disabled={isBusy}
            onClick={() => void createBackup()}
          >
            {isCreating ? 'Creating…' : 'Create Backup'}
          </Button>
        </div>
      </div>

      {__ENABLE_CLOUD_SYNC__ && isCloudConnected && (
        <label className="inline-flex items-center gap-2 text-xs text-tx-secondary select-none cursor-pointer">
          <input
            type="checkbox"
            className="rounded border-line-strong"
            checked={uploadToCloud}
            onChange={(e) => setUploadToCloud(e.target.checked)}
          />
          <span>Also upload newly created or imported backups to Google Drive</span>
        </label>
      )}

      <BackupStatusBanners statusMessage={statusMessage} error={error} />

      {isLoading && backups.length === 0 ? (
        <p className="text-xs text-tx-muted">Loading backups…</p>
      ) : backups.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line-subtle p-4 text-center text-xs text-tx-muted">
          No backups yet. Create a snapshot to protect your library.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {backups.map((backup) => (
            <BackupArtifactRow
              key={backup.id}
              backup={backup}
              isCloudConnected={isCloudConnected}
              isConfirming={pendingRestoreId === backup.id}
              isBusy={isBusy}
              isRestoring={isRestoring}
              isUploading={uploadingBackupId === backup.id}
              isExporting={exportingBackupId === backup.id}
              isDeleting={deletingBackupId === backup.id}
              onRequestRestore={requestRestore}
              onConfirmRestore={(id) => void confirmRestore(id)}
              onCancelRestore={cancelRestore}
              onUploadToCloud={(id) => void uploadBackupToCloud(id)}
              onDeleteRemote={(id) => void deleteRemoteBackup(id)}
              onExport={(id) => void exportBackup(id)}
              onDelete={(id) => void deleteBackup(id)}
            />
          ))}
        </div>
      )}
    </Card>
  );
});
