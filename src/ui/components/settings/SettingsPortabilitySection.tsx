import { Card } from '@ui';
import { memo } from 'react';

export interface SettingsPortabilitySectionProps {
  readonly onExportAnnotations: () => void;
  readonly onImportBackup: () => void;
}

export const SettingsPortabilitySection = memo(function SettingsPortabilitySection({
  onExportAnnotations,
  onImportBackup,
}: SettingsPortabilitySectionProps) {
  return (
    <Card variant="surface" padding="md" className="flex flex-col gap-4">
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-tx-muted">
          Data Portability
        </h2>
        <p className="mt-1 text-xs text-tx-secondary">
          Export reading metrics and annotations into standard open formats:
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card
          variant="interactive"
          padding="sm"
          rounded="lg"
          className="flex flex-col gap-1 text-left"
          onClick={onExportAnnotations}
        >
          <span className="text-xs font-medium text-tx-main">Export Annotations</span>
          <span className="text-[0.68rem] text-tx-muted">
            Package all notes and highlights as a JSON bundle.
          </span>
        </Card>

        <Card
          variant="interactive"
          padding="sm"
          rounded="lg"
          className="flex flex-col gap-1 text-left"
          onClick={onImportBackup}
        >
          <span className="text-xs font-medium text-tx-main">Import Backup</span>
          <span className="text-[0.68rem] text-tx-muted">
            Merge external notes using Last-Write-Wins rules.
          </span>
        </Card>
      </div>
    </Card>
  );
});
