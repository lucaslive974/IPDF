import { useCallback, useEffect, useState } from 'react';
import type { PresenceHealthStatus } from '../../core/ports/IPresenceService';
import { useServiceContainer } from '../providers/ServiceContainerContext';

export interface SettingsHook {
  readonly monitoredFolders: string[];
  readonly newFolderInput: string;
  readonly isDriveConnected: boolean;
  readonly isDiscordEnabled: boolean;
  readonly discordHealth: PresenceHealthStatus | null;
  readonly isCheckingDiscordHealth: boolean;
  readonly syncStatusMessage: string | null;
  readonly syncExportPreview: string;
  readonly showResetConfirm: boolean;
  setNewFolderInput(value: string): void;
  setShowResetConfirm(value: boolean): void;
  addFolder(): void;
  removeFolder(index: number): void;
  toggleDriveConnection(): void;
  toggleDiscordPresence(): Promise<void>;
  checkDiscordHealth(): Promise<void>;
  triggerSync(bookHash?: string): Promise<void>;
  resetDatabase(): Promise<void>;
}

export function useSettings(): SettingsHook {
  const { settingsService, presenceService } = useServiceContainer();

  const [monitoredFolders, setMonitoredFolders] = useState<string[]>([
    '~/Documents/PhilosophyBooks',
    '~/.var/app/com.scholarium.reader/data/books',
  ]);
  const [newFolderInput, setNewFolderInput] = useState<string>('');
  const [isDriveConnected, setIsDriveConnected] = useState<boolean>(true);
  const [isDiscordEnabled, setIsDiscordEnabled] = useState<boolean>(true);
  const [discordHealth, setDiscordHealth] = useState<PresenceHealthStatus | null>(null);
  const [isCheckingDiscordHealth, setIsCheckingDiscordHealth] = useState<boolean>(false);
  const [syncStatusMessage, setSyncStatusMessage] = useState<string | null>(null);
  const [syncExportPreview, setSyncExportPreview] = useState<string>('');
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);

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
    let mounted = true;
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

  const addFolder = useCallback(() => {
    if (newFolderInput.trim().length > 0) {
      setMonitoredFolders((prev) => [...prev, newFolderInput.trim()]);
      setNewFolderInput('');
    }
  }, [newFolderInput]);

  const removeFolder = useCallback((index: number) => {
    setMonitoredFolders((prev) => prev.filter((_, idx) => idx !== index));
  }, []);

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
    setShowResetConfirm(false);
  }, []);

  return {
    monitoredFolders,
    newFolderInput,
    isDriveConnected,
    isDiscordEnabled,
    discordHealth,
    isCheckingDiscordHealth,
    syncStatusMessage,
    syncExportPreview,
    showResetConfirm,
    setNewFolderInput,
    setShowResetConfirm,
    addFolder,
    removeFolder,
    toggleDriveConnection,
    toggleDiscordPresence,
    checkDiscordHealth,
    triggerSync,
    resetDatabase,
  };
}
