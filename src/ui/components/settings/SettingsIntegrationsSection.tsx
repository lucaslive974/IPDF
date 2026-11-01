import { memo } from 'react';
import { Badge, Button, Card } from '../ui';

export interface SettingsIntegrationsSectionProps {
  readonly isDiscordEnabled: boolean;
  readonly onToggleDiscord: () => void;
}

export const SettingsIntegrationsSection = memo(function SettingsIntegrationsSection({
  isDiscordEnabled,
  onToggleDiscord,
}: SettingsIntegrationsSectionProps) {
  return (
    <Card variant="surface" padding="md" className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-tx-muted">
            Rich Presence & Social
          </h2>
          <p className="mt-1 text-xs text-tx-secondary">
            Real-time reading status broadcast for community study sessions:
          </p>
        </div>
        <Badge variant={isDiscordEnabled ? 'success' : 'faint'} size="xs">
          {isDiscordEnabled ? 'Discord Active' : 'Discord Off'}
        </Badge>
      </div>

      <Card
        variant="subtle"
        padding="sm"
        rounded="lg"
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
      >
        <div>
          <span className="text-xs font-medium text-tx-main block">Discord Rich Presence</span>
          <span className="text-[0.68rem] text-tx-muted">
            Broadcast current book, author, chapter, reading progress, and elapsed time via native
            IPC
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={isDiscordEnabled ? 'outline' : 'primary'}
            size="sm"
            onClick={onToggleDiscord}
          >
            {isDiscordEnabled ? 'Disable' : 'Enable'}
          </Button>
        </div>
      </Card>
    </Card>
  );
});
