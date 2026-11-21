import { type UseCloudSyncReturn, useCloudSync } from '@hooks/useCloudSync';
import { Badge, Button, Card } from '@ui';
import { memo } from 'react';

export interface SettingsSyncSectionProps {
  readonly state?: UseCloudSyncReturn;
}

const SYNC_INTERVAL_OPTIONS: readonly { readonly label: string; readonly secs: number }[] = [
  { label: 'Manual', secs: 0 },
  { label: '30s', secs: 30 },
  { label: '1m', secs: 60 },
  { label: '2m', secs: 120 },
  { label: '5m', secs: 300 },
  { label: '15m', secs: 900 },
];

function formatSyncTimestamp(ms: number | null): string {
  if (!ms) return 'Never synced';
  return new Date(ms).toLocaleString();
}

export const SettingsSyncSection = memo(function SettingsSyncSection({
  state: injectedState,
}: SettingsSyncSectionProps) {
  const hookState = useCloudSync();
  const {
    status,
    pendingAuthUrl,
    isBusy,
    error,
    beginGoogleOAuth,
    connectGoogleDrive,
    disconnect,
    syncNow,
    setIntervalSecs,
    clearCloudData,
  } = injectedState ?? hookState;

  const isConnected = status?.connected ?? false;
  const isSyncing = isBusy || status?.state === 'syncing';
  const intervalSecs = status?.intervalSecs ?? 120;
  const displayError = error ?? status?.lastError ?? null;

  const handleConnect = () => {
    if (__IS_MOBILE__) {
      void beginGoogleOAuth();
    } else {
      void connectGoogleDrive();
    }
  };

  return (
    <Card variant="surface" padding="md" className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-tx-muted">
            Cloud Sync
          </h2>
          <p className="mt-1 text-xs text-tx-secondary">
            Automatic synchronization for metadata, reading progress, highlights, and covers (book
            files download on demand):
          </p>
        </div>
        <Badge variant={isConnected ? 'brand' : 'neutral'} size="xs">
          {isSyncing ? 'Syncing…' : isConnected ? 'Connected' : 'Local Only'}
        </Badge>
      </div>

      <Card
        variant="subtle"
        padding="sm"
        rounded="lg"
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
      >
        <div className="min-w-0 flex-1 flex flex-col gap-1">
          <span className="text-xs font-medium text-tx-main">
            {isConnected
              ? `Google Drive (appDataFolder)${status?.accountLabel ? ` · ${status.accountLabel}` : ''}`
              : 'Google Drive (Hidden App Folder)'}
          </span>
          <span className="text-xs text-tx-muted">
            {isConnected
              ? `Rev ${status?.lastRevision ?? 0} · ${formatSyncTimestamp(status?.lastSyncedAtMs ?? null)}`
              : 'Sign in with Google to keep your library and annotations synced across devices.'}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {isConnected ? (
            <>
              <Button
                variant="primary"
                size="sm"
                className="whitespace-nowrap"
                disabled={isSyncing}
                onClick={() => void syncNow()}
              >
                {isSyncing ? 'Syncing…' : 'Sync Now'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="whitespace-nowrap"
                disabled={isSyncing}
                onClick={() => void disconnect()}
              >
                Disconnect
              </Button>
            </>
          ) : (
            <Button
              variant="primary"
              size="sm"
              className="whitespace-nowrap"
              disabled={isSyncing}
              onClick={handleConnect}
            >
              {isSyncing ? 'Waiting for sign-in…' : 'Connect Google Drive'}
            </Button>
          )}
        </div>
      </Card>

      {!isConnected && pendingAuthUrl && (
        <Card variant="subtle" padding="sm" rounded="lg" className="text-xs text-tx-secondary">
          Waiting for Google sign-in in your browser…
        </Card>
      )}

      {isConnected && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-tx-secondary mr-1">Auto-sync interval:</span>
            {SYNC_INTERVAL_OPTIONS.map((opt) => (
              <Button
                key={opt.secs}
                variant={intervalSecs === opt.secs ? 'primary' : 'outline'}
                size="xs"
                disabled={isSyncing}
                onClick={() => void setIntervalSecs(opt.secs)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
          <Button
            variant="danger-subtle"
            size="xs"
            className="whitespace-nowrap"
            disabled={isSyncing}
            onClick={() => void clearCloudData()}
          >
            Clear Cloud Data
          </Button>
        </div>
      )}

      {displayError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-500">
          {displayError}
        </div>
      )}
    </Card>
  );
});
