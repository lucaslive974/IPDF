import type { PresenceHealthStatus } from '@ports/IPresenceService';
import { Badge, type BadgeVariant, Button, Card } from '@ui';
import { memo } from 'react';

export interface SettingsIntegrationsSectionProps {
  readonly isDiscordEnabled: boolean;
  readonly discordHealth?: PresenceHealthStatus | null;
  readonly isCheckingDiscordHealth?: boolean;
  readonly onToggleDiscord: () => void;
  readonly onCheckDiscordHealth?: () => void;
}

export const SettingsIntegrationsSection = memo(function SettingsIntegrationsSection({
  isDiscordEnabled,
  discordHealth,
  isCheckingDiscordHealth = false,
  onToggleDiscord,
  onCheckDiscordHealth,
}: SettingsIntegrationsSectionProps) {
  let badgeVariant: BadgeVariant = 'faint';
  let badgeLabel = 'Discord Disabled';

  if (isDiscordEnabled) {
    if (discordHealth?.ok) {
      badgeVariant = 'success';
      badgeLabel = 'Discord Connected';
    } else if (discordHealth && !discordHealth.ok) {
      badgeVariant = 'warning';
      badgeLabel = 'Discord Disconnected';
    } else {
      badgeVariant = 'neutral';
      badgeLabel = 'Checking...';
    }
  }

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
        <Badge variant={badgeVariant} size="xs">
          {badgeLabel}
        </Badge>
      </div>

      <Card
        variant="subtle"
        padding="sm"
        rounded="lg"
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
      >
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-tx-main block">Discord Rich Presence</span>
          <span className="text-[0.68rem] text-tx-muted">
            Broadcast library browsing, annotation reviews, reading progress, and elapsed time via
            native IPC
          </span>
          {isDiscordEnabled && discordHealth && (
            <span
              className={`text-[0.68rem] font-medium ${
                discordHealth.ok
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-amber-600 dark:text-amber-400'
              }`}
            >
              Status: {discordHealth.message}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isDiscordEnabled && onCheckDiscordHealth && (
            <Button
              variant="outline"
              size="sm"
              disabled={isCheckingDiscordHealth}
              onClick={onCheckDiscordHealth}
            >
              {isCheckingDiscordHealth ? 'Checking...' : 'Check Status'}
            </Button>
          )}
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
