import { Button, Card } from '@ui';
import { memo } from 'react';

export interface SettingsDangerSectionProps {
  readonly showResetConfirm: boolean;
  readonly isResetting?: boolean;
  readonly resetError?: string | null;
  readonly onShowResetConfirm: (show: boolean) => void;
  readonly onResetDatabase: () => void;
}

export const SettingsDangerSection = memo(function SettingsDangerSection({
  showResetConfirm,
  isResetting = false,
  resetError = null,
  onShowResetConfirm,
  onResetDatabase,
}: SettingsDangerSectionProps) {
  return (
    <Card variant="subtle" padding="md" className="flex flex-col gap-4 border-line-subtle">
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-tx-muted">
          Maintenance
        </h2>
        <p className="mt-1 text-xs text-tx-secondary">
          Clear local SQLite databases, reset highlights, and purge cached book covers:
        </p>
      </div>

      {!showResetConfirm ? (
        <div>
          <Button variant="danger-subtle" size="sm" onClick={() => onShowResetConfirm(true)}>
            Reset Database &amp; Cache
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2 rounded-lg border border-line-strong bg-surface p-3.5">
          <div className="flex items-center gap-3">
            <span className="flex-1 text-xs font-medium text-tx-main">
              Are you sure? This will permanently delete all local books, covers, and highlights.
            </span>
            <Button variant="danger" size="sm" disabled={isResetting} onClick={onResetDatabase}>
              {isResetting ? 'Resetting…' : 'Confirm Reset'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={isResetting}
              onClick={() => onShowResetConfirm(false)}
            >
              Cancel
            </Button>
          </div>
          {resetError && <p className="text-xs text-red-500">{resetError}</p>}
        </div>
      )}
    </Card>
  );
});
