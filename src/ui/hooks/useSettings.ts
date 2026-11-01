import { useCallback, useEffect, useState } from 'react';
import { useServiceContainer } from '../providers/ServiceContainerContext';

export interface SettingsHook {
  readonly monitoredFolders: string[];
  readonly newFolderInput: string;
  readonly isDriveConnected: boolean;
  readonly isDiscordEnabled: boolean;
  readonly syncStatusMessage: string | null;
  readonly syncExportPreview: string;
  readonly showResetConfirm: boolean;
  setNewFolderInput(value: string): void;
  setShowResetConfirm(value: boolean): void;
  addFolder(): void;
  removeFolder(index: number): void;
  toggleDriveConnection(): void;
  toggleDiscordPresence(): Promise<void>;
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
  const [syncStatusMessage, setSyncStatusMessage] = useState<string | null>(null);
  const [syncExportPreview, setSyncExportPreview] = useState<string>('');
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;
    void settingsService.getAppSetting('discord_presence_enabled').then((val) => {
      if (mounted && val !== null) {
        setIsDiscordEnabled(val !== 'false');
      }
    });
    return () => {
      mounted = false;
    };
  }, [settingsService]);

  const toggleDiscordPresence = useCallback(async () => {
    const next = !isDiscordEnabled;
    setIsDiscordEnabled(next);
    await presenceService.setDiscordPresenceEnabled(next);
  }, [isDiscordEnabled, presenceService]);

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
    syncStatusMessage,
    syncExportPreview,
    showResetConfirm,
    setNewFolderInput,
    setShowResetConfirm,
    addFolder,
    removeFolder,
    toggleDriveConnection,
    toggleDiscordPresence,
    triggerSync,
    resetDatabase,
  };
}
