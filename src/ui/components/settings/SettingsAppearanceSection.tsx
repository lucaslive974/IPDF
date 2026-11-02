import { Card, MoonIcon, SunIcon } from '@ui';
import { memo } from 'react';

export interface SettingsAppearanceSectionProps {
  readonly theme: string;
  readonly onSetTheme: (theme: 'light' | 'dark') => void;
}

export const SettingsAppearanceSection = memo(function SettingsAppearanceSection({
  theme,
  onSetTheme,
}: SettingsAppearanceSectionProps) {
  return (
    <Card variant="surface" padding="md" className="flex flex-col gap-4">
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-tx-muted">Appearance</h2>
        <p className="mt-1 text-xs text-tx-secondary">
          Select reading workspace theme. Tokens adapt to minimize eye strain:
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md">
        <button
          type="button"
          className={`flex items-center justify-between rounded-lg border p-3 text-xs font-medium transition cursor-pointer ${
            theme === 'light'
              ? 'border-tx-main bg-surface-subtle text-tx-main shadow-2xs'
              : 'border-line-subtle bg-surface/50 text-tx-muted hover:border-line-strong'
          }`}
          onClick={() => onSetTheme('light')}
        >
          <div className="flex items-center gap-2.5">
            <SunIcon className="h-4 w-4 text-tx-main" />
            <div className="text-left">
              <div className="font-medium text-tx-main">Warm Paper</div>
              <div className="text-[0.65rem] text-tx-muted">Ivory tone for daylight reading</div>
            </div>
          </div>
          {theme === 'light' && <span className="text-tx-main font-semibold text-xs">Active</span>}
        </button>

        <button
          type="button"
          className={`flex items-center justify-between rounded-lg border p-3 text-xs font-medium transition cursor-pointer ${
            theme === 'dark'
              ? 'border-tx-main bg-surface-subtle text-tx-main shadow-2xs'
              : 'border-line-subtle bg-surface/50 text-tx-muted hover:border-line-strong'
          }`}
          onClick={() => onSetTheme('dark')}
        >
          <div className="flex items-center gap-2.5">
            <MoonIcon className="h-4 w-4 text-tx-main" />
            <div className="text-left">
              <div className="font-medium text-tx-main">Warm Graphite</div>
              <div className="text-[0.65rem] text-tx-muted">Soft charcoal for low-light study</div>
            </div>
          </div>
          {theme === 'dark' && <span className="text-tx-main font-semibold text-xs">Active</span>}
        </button>
      </div>
    </Card>
  );
});
