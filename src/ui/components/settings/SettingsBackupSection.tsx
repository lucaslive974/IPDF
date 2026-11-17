import { formatBackupSize, type UseBackupReturn, useBackup } from '@hooks/useBackup';
import { Badge, Button, Card } from '@ui';
import { memo } from 'react';

export interface SettingsBackupSectionProps {
  readonly state?: UseBackupReturn;
}

function formatBackupDate(createdAtMs: number): string {
  if (!createdAtMs) return 'Unknown date';
  return new Date(createdAtMs).toLocaleString();
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
    requestRestore,
    cancelRestore,
    confirmRestore,
    deleteBackup,
  } = injectedState ?? hookState;

  return (
    <Card variant="surface" padding="md" className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-tx-muted">Backups</h2>
          <p className="mt-1 text-xs text-tx-secondary">
            Create and restore full local snapshots of your books, covers, database, and highlights:
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          disabled={isCreating || isRestoring}
          onClick={() => void createBackup()}
        >
          {isCreating ? 'Creating…' : 'Create Backup'}
        </Button>
      </div>

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

      {isLoading && backups.length === 0 ? (
        <p className="text-xs text-tx-muted">Loading local backups…</p>
      ) : backups.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line-subtle p-4 text-center text-xs text-tx-muted">
          No local backups yet. Create a snapshot to protect your library.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {backups.map((backup) => {
            const isConfirming = pendingRestoreId === backup.id;
            return (
              <Card
                key={backup.id}
                variant="subtle"
                padding="sm"
                rounded="lg"
                className="flex flex-col gap-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-xs font-medium text-tx-main">
                        {backup.name}
                      </span>
                      <Badge variant="neutral" size="xs">
                        {formatBackupSize(backup.sizeBytes)}
                      </Badge>
                    </div>
                    <span className="text-xs text-tx-muted">
                      {formatBackupDate(backup.createdAtMs)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="xs"
                      disabled={isRestoring || isCreating}
                      onClick={() => requestRestore(backup.id)}
                    >
                      Restore
                    </Button>
                    <Button
                      variant="danger-subtle"
                      size="xs"
                      disabled={isRestoring || isCreating}
                      onClick={() => void deleteBackup(backup.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>

                {isConfirming && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-md border border-line-strong bg-surface p-2.5">
                    <span className="text-xs text-tx-secondary">
                      Restore this snapshot? Current local books and highlights will be replaced.
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="danger"
                        size="xs"
                        disabled={isRestoring}
                        onClick={() => void confirmRestore(backup.id)}
                      >
                        {isRestoring ? 'Restoring…' : 'Confirm Restore'}
                      </Button>
                      <Button
                        variant="outline"
                        size="xs"
                        disabled={isRestoring}
                        onClick={cancelRestore}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </Card>
  );
});
