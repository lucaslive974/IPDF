import { memo } from 'react';
import { Button, Card, CloseIcon, IconButton, Input } from '../ui';

export interface SettingsFoldersSectionProps {
  readonly monitoredFolders: readonly string[];
  readonly newFolderInput: string;
  readonly onNewFolderInputChange: (val: string) => void;
  readonly onAddFolder: () => void;
  readonly onRemoveFolder: (index: number) => void;
}

export const SettingsFoldersSection = memo(function SettingsFoldersSection({
  monitoredFolders,
  newFolderInput,
  onNewFolderInputChange,
  onAddFolder,
  onRemoveFolder,
}: SettingsFoldersSectionProps) {
  return (
    <Card variant="surface" padding="md" className="flex flex-col gap-4">
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-tx-muted">
          Monitored Storage Folders
        </h2>
        <p className="mt-1 text-xs text-tx-secondary">
          The reader automatically indexes .epub and .pdf files found in these directories:
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {monitoredFolders.map((folder, idx) => (
          <Card
            key={`folder-${idx + 1}`}
            variant="subtle"
            padding="sm"
            rounded="lg"
            className="flex items-center justify-between font-mono text-xs text-tx-secondary"
          >
            <span>{folder}</span>
            <IconButton
              variant="ghost"
              size="xs"
              label="Remove folder"
              onClick={() => onRemoveFolder(idx)}
            >
              <CloseIcon className="h-3.5 w-3.5" />
            </IconButton>
          </Card>
        ))}
      </div>

      <div className="flex gap-2">
        <Input
          containerClassName="flex-1"
          placeholder="e.g. /home/user/Books"
          value={newFolderInput}
          onChange={(e) => onNewFolderInputChange(e.target.value)}
        />
        <Button variant="secondary" size="md" onClick={onAddFolder}>
          Add Directory
        </Button>
      </div>
    </Card>
  );
});
