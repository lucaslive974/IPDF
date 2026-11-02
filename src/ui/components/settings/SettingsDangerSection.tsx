import { Button, Card } from '@ui';
import { memo } from 'react';

export interface SettingsDangerSectionProps {
  readonly showResetConfirm: boolean;
  readonly onShowResetConfirm: (show: boolean) => void;
  readonly onResetDatabase: () => void;
}

export const SettingsDangerSection = memo(function SettingsDangerSection({
  showResetConfirm,
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
        <div className="flex items-center gap-3 rounded-lg border border-line-strong bg-surface p-3.5">
          <span className="text-xs text-tx-main font-medium flex-1">
            Are you sure? This action will reset your local database.
          </span>
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              onResetDatabase();
              alert('Database reset completed.');
            }}
          >
            Confirm Reset
          </Button>
          <Button variant="outline" size="sm" onClick={() => onShowResetConfirm(false)}>
            Cancel
          </Button>
        </div>
      )}
    </Card>
  );
});
