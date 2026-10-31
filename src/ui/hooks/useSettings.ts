import { useCallback, useState } from 'react';
import { useServiceContainer } from '../providers/ServiceContainerContext';

export interface SettingsHook {
  readonly monitoredFolders: string[];
  readonly newFolderInput: string;
  readonly isDriveConnected: boolean;
  readonly syncStatusMessage: string | null;
  readonly syncExportPreview: string;
  readonly showResetConfirm: boolean;
  setNewFolderInput(value: string): void;
  setShowResetConfirm(value: boolean): void;
  addFolder(): void;
  removeFolder(index: number): void;
  toggleDriveConnection(): void;
  triggerSync(bookHash?: string): Promise<void>;
  resetDatabase(): Promise<void>;
}

export function useSettings(): SettingsHook {
  const { services } = useServiceContainer();

  const [monitoredFolders, setMonitoredFolders] = useState<string[]>([
    '~/Documents/PhilosophyBooks',
    '~/.var/app/com.ipdf.reader/data/books',
  ]);
  const [newFolderInput, setNewFolderInput] = useState<string>('');
  const [isDriveConnected, setIsDriveConnected] = useState<boolean>(true);
  const [syncStatusMessage, setSyncStatusMessage] = useState<string | null>(null);
  const [syncExportPreview, setSyncExportPreview] = useState<string>('');
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);

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
      const exportedJson = await services.syncBookWorkspace(bookHash);
      setSyncExportPreview(exportedJson);
      setSyncStatusMessage('Last-Write-Wins synchronization completed successfully!');
      setTimeout(() => setSyncStatusMessage(null), 4000);
    },
    [services]
  );

  const resetDatabase = useCallback(async () => {
    setShowResetConfirm(false);
  }, []);

  return {
    monitoredFolders,
    newFolderInput,
    isDriveConnected,
    syncStatusMessage,
    syncExportPreview,
    showResetConfirm,
    setNewFolderInput,
    setShowResetConfirm,
    addFolder,
    removeFolder,
    toggleDriveConnection,
    triggerSync,
    resetDatabase,
  };
}
