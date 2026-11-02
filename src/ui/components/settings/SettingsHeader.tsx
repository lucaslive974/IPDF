import { ArrowLeftIcon, Button } from '@ui';
import { memo } from 'react';

export interface SettingsHeaderProps {
  readonly onBack: () => void;
}

export const SettingsHeader = memo(function SettingsHeader({ onBack }: SettingsHeaderProps) {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line-subtle/70 bg-canvas/80 px-6 py-3.5 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          iconLeft={<ArrowLeftIcon className="h-3.5 w-3.5" />}
          onClick={onBack}
        >
          Library
        </Button>
        <h1 className="text-sm font-semibold text-tx-main tracking-tight">Preferences</h1>
      </div>
    </header>
  );
});
