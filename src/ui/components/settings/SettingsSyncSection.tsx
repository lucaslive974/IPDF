import { Badge, Button, Card } from '@ui';
import { memo } from 'react';

export interface SettingsSyncSectionProps {
  readonly isDriveConnected: boolean;
  readonly syncStatusMessage: string | null;
  readonly onTriggerSync: () => void;
  readonly onToggleDriveConnection: () => void;
}

export const SettingsSyncSection = memo(function SettingsSyncSection({
  isDriveConnected,
  syncStatusMessage,
  onTriggerSync,
  onToggleDriveConnection,
}: SettingsSyncSectionProps) {
  return (
    <Card variant="surface" padding="md" className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-tx-muted">
            Cloudless Sync (BYOC)
          </h2>
          <p className="mt-1 text-xs text-tx-secondary">
            Zero-server synchronization with Last-Write-Wins (LWW) conflict resolution:
          </p>
        </div>
        <Badge variant="neutral" size="xs">
          {isDriveConnected ? 'Connected' : 'Local Only'}
        </Badge>
      </div>

      <Card
        variant="subtle"
        padding="sm"
        rounded="lg"
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
      >
        <div>
          <span className="text-xs font-medium text-tx-main block">Target: /Scholarium_Sync/</span>
          <span className="text-[0.68rem] text-tx-muted">
            Highlights, reading metrics, and margin notes
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="primary" size="sm" onClick={onTriggerSync}>
            Sync Now
          </Button>
          <Button variant="outline" size="sm" onClick={onToggleDriveConnection}>
            {isDriveConnected ? 'Disconnect' : 'Connect'}
          </Button>
        </div>
      </Card>

      {syncStatusMessage && (
        <div className="rounded-lg border border-line-subtle bg-surface-subtle p-3 text-xs text-tx-secondary transition-opacity duration-200">
          {syncStatusMessage}
        </div>
      )}
    </Card>
  );
});
