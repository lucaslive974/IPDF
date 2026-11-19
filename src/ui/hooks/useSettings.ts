import type { PresenceHealthStatus } from '@ports/IPresenceService';
import { useServiceContainer } from '@providers/ServiceContainerContext';
import { useHighlightStore } from '@stores/useHighlightStore';
import { useLibraryStore } from '@stores/useLibraryStore';
import { useReaderStore } from '@stores/useReaderStore';
import { useTypographyStore } from '@stores/useTypographyStore';
import { appLogger } from '@utils/logger';
import { useCallback, useEffect, useState } from 'react';

export interface SettingsHook {
  readonly isDriveConnected: boolean;
  readonly isDiscordEnabled: boolean;
  readonly supportsDiscordPresence: boolean;
  readonly discordHealth: PresenceHealthStatus | null;
  readonly isCheckingDiscordHealth: boolean;
  readonly syncStatusMessage: string | null;
  readonly syncExportPreview: string;
  readonly showResetConfirm: boolean;
  readonly isResettingDatabase: boolean;
  readonly resetError: string | null;
  setShowResetConfirm(value: boolean): void;
  toggleDriveConnection(): void;
  toggleDiscordPresence(): Promise<void>;
  checkDiscordHealth(): Promise<void>;
  triggerSync(bookHash?: string): Promise<void>;
  resetDatabase(): Promise<void>;
}

export function useSettings(): SettingsHook {
  const { settingsService, presenceService } = useServiceContainer();

  const [isDriveConnected, setIsDriveConnected] = useState<boolean>(true);
  const [isDiscordEnabled, setIsDiscordEnabled] = useState<boolean>(true);
  const [supportsDiscordPresence, setSupportsDiscordPresence] = useState<boolean>(true);
  const [discordHealth, setDiscordHealth] = useState<PresenceHealthStatus | null>(null);
  const [isCheckingDiscordHealth, setIsCheckingDiscordHealth] = useState<boolean>(false);
  const [syncStatusMessage, setSyncStatusMessage] = useState<string | null>(null);
  const [syncExportPreview, setSyncExportPreview] = useState<string>('');
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);
  const [isResettingDatabase, setIsResettingDatabase] = useState<boolean>(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const checkDiscordHealth = useCallback(async () => {
    setIsCheckingDiscordHealth(true);
    try {
      const status = await presenceService.getDiscordPresenceHealth();
      setDiscordHealth(status);
    } catch (err) {
      setDiscordHealth({
        ok: false,
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsCheckingDiscordHealth(false);
    }
  }, [presenceService]);

  useEffect(() => {
    if (__IS_MOBILE__) {
      return;
    }
    let mounted = true;
    void settingsService.getPlatformInfo().then((info) => {
      if (mounted) {
        setSupportsDiscordPresence(info.supportsDiscordPresence);
      }
    });
    void settingsService.getAppSetting('discord_presence_enabled').then((val) => {
      if (mounted && val !== null) {
        const enabled = val !== 'false';
        setIsDiscordEnabled(enabled);
        if (enabled) {
          void checkDiscordHealth();
        }
      } else if (mounted) {
        void checkDiscordHealth();
      }
    });
    return () => {
      mounted = false;
    };
  }, [settingsService, checkDiscordHealth]);

  const toggleDiscordPresence = useCallback(async () => {
    const next = !isDiscordEnabled;
    setIsDiscordEnabled(next);
    await presenceService.setDiscordPresenceEnabled(next);
    if (next) {
      await checkDiscordHealth();
    } else {
      setDiscordHealth({
        ok: false,
        message: 'Discord Rich Presence is disabled in settings',
      });
    }
  }, [isDiscordEnabled, presenceService, checkDiscordHealth]);

  const toggleDriveConnection = useCallback(() => {
    setIsDriveConnected((prev) => !prev);
  }, []);

  const triggerSync = useCallback(
    async (bookHash = 'sha256-plato-republic-book-vii') => {
      const exportedJson = await settingsService.syncBookWorkspace(bookHash);
      setSyncExportPreview(exportedJson);
      setSyncStatusMessage('Last-Write-Wins synchronization completed successfully!');
      setTimeout(() => setSyncStatusMessage(null), 4000);
    },
    [settingsService]
  );

  const resetDatabase = useCallback(async () => {
    setIsResettingDatabase(true);
    setResetError(null);
    try {
      await settingsService.resetApplicationData();
      useLibraryStore.getState().reset();
      useHighlightStore.getState().reset();
      useReaderStore.getState().reset();
      useTypographyStore.getState().reset();
      setShowResetConfirm(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      appLogger.error(`Failed to reset application data: ${message}`, 'maintenance');
      setResetError(message);
    } finally {
      setIsResettingDatabase(false);
    }
  }, [settingsService]);

  return {
    isDriveConnected,
    isDiscordEnabled,
    supportsDiscordPresence,
    discordHealth,
    isCheckingDiscordHealth,
    syncStatusMessage,
    syncExportPreview,
    showResetConfirm,
    isResettingDatabase,
    resetError,
    setShowResetConfirm,
    toggleDriveConnection,
    toggleDiscordPresence,
    checkDiscordHealth,
    triggerSync,
    resetDatabase,
  };
}
