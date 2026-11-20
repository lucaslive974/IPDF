import type { BookAvailability, CloudSyncStatus, ISyncService } from '@core/ports/ISyncService';
import type { IHighlightService, ILibraryService } from '@ports';
import { useServiceContainer } from '@providers/ServiceContainerContext';
import { useHighlightStore } from '@stores/useHighlightStore';
import { useLibraryStore } from '@stores/useLibraryStore';
import { useSyncStore } from '@stores/useSyncStore';
import { hasDocument } from '@utils/dom';
import { useCallback, useEffect } from 'react';

export interface UseCloudSyncReturn {
  readonly status: CloudSyncStatus | null;
  readonly availabilities: Readonly<Record<string, BookAvailability>>;
  readonly downloadingHashes: Readonly<Record<string, boolean>>;
  readonly pendingAuthUrl: string | null;
  readonly isBusy: boolean;
  readonly error: string | null;
  refreshStatus(): Promise<void>;
  beginGoogleOAuth(clientIdOverride?: string): Promise<string | null>;
  completeGoogleOAuth(code: string, accountLabel?: string): Promise<void>;
  connectGoogleDrive(): Promise<void>;
  disconnect(): Promise<void>;
  syncNow(): Promise<void>;
  setIntervalSecs(intervalSecs: number): Promise<void>;
  downloadBook(bookHash: string): Promise<void>;
  evictLocalBook(bookHash: string): Promise<void>;
  clearCloudData(): Promise<number>;
}

function toErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export async function rehydrateSyncedStores(
  libraryService: ILibraryService,
  highlightService: IHighlightService,
  syncService: ISyncService
): Promise<void> {
  const [books, highlights, nextAvailabilities] = await Promise.all([
    libraryService.listLibraryBooks(),
    highlightService.loadAllHighlights(),
    syncService.listBookAvailabilities(),
  ]);
  useLibraryStore.getState().setBooks(books);
  useHighlightStore.getState().setHighlights(highlights);
  useSyncStore.getState().setAvailabilities(nextAvailabilities);
}

export async function executeRefreshSyncStatus(syncService: ISyncService): Promise<void> {
  try {
    const [nextStatus, nextAvailabilities] = await Promise.all([
      syncService.getCloudSyncStatus(),
      syncService.listBookAvailabilities(),
    ]);
    useSyncStore.getState().setStatus(nextStatus);
    useSyncStore.getState().setAvailabilities(nextAvailabilities);
    useSyncStore.getState().setError(null);
  } catch (err) {
    useSyncStore.getState().setError(toErrorMessage(err));
  }
}

export async function executeBeginGoogleOAuth(
  syncService: ISyncService,
  clientIdOverride?: string
): Promise<string | null> {
  useSyncStore.getState().setIsBusy(true);
  useSyncStore.getState().setError(null);
  try {
    const res = await syncService.beginGoogleOAuth(clientIdOverride);
    useSyncStore.getState().setPendingAuthUrl(res.authUrl);
    return res.authUrl;
  } catch (err) {
    useSyncStore.getState().setError(toErrorMessage(err));
    return null;
  } finally {
    useSyncStore.getState().setIsBusy(false);
  }
}

export async function executeCompleteGoogleOAuth(
  syncService: ISyncService,
  code: string,
  accountLabel?: string
): Promise<void> {
  useSyncStore.getState().setIsBusy(true);
  useSyncStore.getState().setError(null);
  try {
    const nextStatus = await syncService.completeGoogleOAuth(code, accountLabel);
    useSyncStore.getState().setStatus(nextStatus);
    useSyncStore.getState().setPendingAuthUrl(null);
  } catch (err) {
    useSyncStore.getState().setError(toErrorMessage(err));
  } finally {
    useSyncStore.getState().setIsBusy(false);
  }
}

export async function executeConnectGoogleDrive(syncService: ISyncService): Promise<void> {
  useSyncStore.getState().setIsBusy(true);
  useSyncStore.getState().setError(null);
  try {
    const nextStatus = await syncService.connectGoogleDrive();
    useSyncStore.getState().setStatus(nextStatus);
    useSyncStore.getState().setPendingAuthUrl(null);
  } catch (err) {
    useSyncStore.getState().setError(toErrorMessage(err));
  } finally {
    useSyncStore.getState().setIsBusy(false);
  }
}

export async function executeDisconnectCloud(
  syncService: ISyncService,
  libraryService?: ILibraryService,
  highlightService?: IHighlightService
): Promise<void> {
  useSyncStore.getState().setIsBusy(true);
  useSyncStore.getState().setError(null);
  try {
    const nextStatus = await syncService.disconnectCloudProvider();
    useSyncStore.getState().setStatus(nextStatus);
    useSyncStore.getState().setPendingAuthUrl(null);
    if (libraryService && highlightService) {
      await rehydrateSyncedStores(libraryService, highlightService, syncService);
    } else {
      await executeRefreshSyncStatus(syncService);
    }
  } catch (err) {
    useSyncStore.getState().setError(toErrorMessage(err));
  } finally {
    useSyncStore.getState().setIsBusy(false);
  }
}

export async function executeSyncNow(
  syncService: ISyncService,
  libraryService: ILibraryService,
  highlightService: IHighlightService
): Promise<void> {
  useSyncStore.getState().setIsBusy(true);
  useSyncStore.getState().setError(null);
  try {
    const report = await syncService.triggerCloudSync();
    if (report.pulledBooks > 0 || report.deletedBooks > 0) {
      await rehydrateSyncedStores(libraryService, highlightService, syncService);
    } else {
      await executeRefreshSyncStatus(syncService);
    }
  } catch (err) {
    useSyncStore.getState().setError(toErrorMessage(err));
  } finally {
    useSyncStore.getState().setIsBusy(false);
  }
}

export async function executeSetSyncInterval(
  syncService: ISyncService,
  intervalSecs: number
): Promise<void> {
  useSyncStore.getState().setError(null);
  try {
    const nextStatus = await syncService.setCloudSyncInterval(intervalSecs);
    useSyncStore.getState().setStatus(nextStatus);
  } catch (err) {
    useSyncStore.getState().setError(toErrorMessage(err));
  }
}

export async function executeDownloadRemoteBook(
  syncService: ISyncService,
  bookHash: string
): Promise<void> {
  useSyncStore.getState().setBookDownloading(bookHash, true);
  useSyncStore.getState().setError(null);
  try {
    await syncService.downloadRemoteBook(bookHash);
    useSyncStore.getState().setBookAvailability(bookHash, 'local');
  } catch (err) {
    useSyncStore.getState().setError(toErrorMessage(err));
  } finally {
    useSyncStore.getState().setBookDownloading(bookHash, false);
  }
}

export async function executeEvictLocalBook(
  syncService: ISyncService,
  bookHash: string
): Promise<void> {
  useSyncStore.getState().setError(null);
  try {
    await syncService.evictLocalBook(bookHash);
    useSyncStore.getState().setBookAvailability(bookHash, 'remoteOnly');
  } catch (err) {
    useSyncStore.getState().setError(toErrorMessage(err));
  }
}

export async function executeClearCloudData(
  syncService: ISyncService,
  libraryService?: ILibraryService,
  highlightService?: IHighlightService
): Promise<number> {
  useSyncStore.getState().setIsBusy(true);
  useSyncStore.getState().setError(null);
  try {
    const deleted = await syncService.clearCloudSyncData();
    if (libraryService && highlightService) {
      await rehydrateSyncedStores(libraryService, highlightService, syncService);
    } else {
      await executeRefreshSyncStatus(syncService);
    }
    return deleted;
  } catch (err) {
    useSyncStore.getState().setError(toErrorMessage(err));
    return 0;
  } finally {
    useSyncStore.getState().setIsBusy(false);
  }
}

/**
 * Global listener mounted once at the app root (when `__ENABLE_CLOUD_SYNC__` is true).
 * Subscribes to backend `sync:status` events, triggers resume checks on visibility change,
 * and rehydrates library/highlight stores whenever remote changes are pulled.
 */
export function useCloudSyncListener(): void {
  const { syncService, libraryService, highlightService } = useServiceContainer();

  useEffect(() => {
    let active = true;
    let unlisten: (() => void) | null = null;

    void executeRefreshSyncStatus(syncService);
    void syncService
      .subscribeStatus((nextStatus) => {
        if (!active) return;
        useSyncStore.getState().setStatus(nextStatus);
        if (nextStatus.state === 'synced' && nextStatus.lastPulledBooks > 0) {
          void rehydrateSyncedStores(libraryService, highlightService, syncService);
        }
      })
      .then((fn) => {
        if (active) {
          unlisten = fn;
        } else {
          fn();
        }
      });

    const handleVisibilityChange = () => {
      if (hasDocument() && !document.hidden) {
        void syncService.notifyAppResumed().then((report) => {
          if (active && report && report.pulledBooks > 0) {
            void rehydrateSyncedStores(libraryService, highlightService, syncService);
          }
        });
      }
    };

    if (hasDocument()) {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      active = false;
      unlisten?.();
      if (hasDocument()) {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, [syncService, libraryService, highlightService]);
}

export function useCloudSync(): UseCloudSyncReturn {
  const { syncService, libraryService, highlightService } = useServiceContainer();
  const status = useSyncStore((s) => s.status);
  const availabilities = useSyncStore((s) => s.availabilities);
  const downloadingHashes = useSyncStore((s) => s.downloadingHashes);
  const pendingAuthUrl = useSyncStore((s) => s.pendingAuthUrl);
  const isBusy = useSyncStore((s) => s.isBusy);
  const error = useSyncStore((s) => s.error);

  const refreshStatus = useCallback(() => executeRefreshSyncStatus(syncService), [syncService]);

  const beginGoogleOAuth = useCallback(
    (clientIdOverride?: string) => executeBeginGoogleOAuth(syncService, clientIdOverride),
    [syncService]
  );
  const completeGoogleOAuth = useCallback(
    (code: string, accountLabel?: string) =>
      executeCompleteGoogleOAuth(syncService, code, accountLabel),
    [syncService]
  );
  const connectGoogleDrive = useCallback(
    () => executeConnectGoogleDrive(syncService),
    [syncService]
  );
  const disconnect = useCallback(
    () => executeDisconnectCloud(syncService, libraryService, highlightService),
    [syncService, libraryService, highlightService]
  );
  const syncNow = useCallback(
    () => executeSyncNow(syncService, libraryService, highlightService),
    [syncService, libraryService, highlightService]
  );
  const setIntervalSecs = useCallback(
    (intervalSecs: number) => executeSetSyncInterval(syncService, intervalSecs),
    [syncService]
  );
  const downloadBook = useCallback(
    (bookHash: string) => executeDownloadRemoteBook(syncService, bookHash),
    [syncService]
  );
  const evictLocalBook = useCallback(
    (bookHash: string) => executeEvictLocalBook(syncService, bookHash),
    [syncService]
  );
  const clearCloudData = useCallback(
    () => executeClearCloudData(syncService, libraryService, highlightService),
    [syncService, libraryService, highlightService]
  );

  return {
    status,
    availabilities,
    downloadingHashes,
    pendingAuthUrl,
    isBusy,
    error,
    refreshStatus,
    beginGoogleOAuth,
    completeGoogleOAuth,
    connectGoogleDrive,
    disconnect,
    syncNow,
    setIntervalSecs,
    downloadBook,
    evictLocalBook,
    clearCloudData,
  };
}
