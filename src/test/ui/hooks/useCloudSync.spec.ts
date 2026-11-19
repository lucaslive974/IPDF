import type {
  BookAvailability,
  CloudSyncStatus,
  ISyncService,
  OAuthStartResult,
  SyncReport,
} from '@core/ports/ISyncService';
import type { BookMetadata } from '@domain/BookMetadata';
import { Highlight } from '@domain/Highlight';
import { BookFormat } from '@domain/types';
import {
  executeBeginGoogleOAuth,
  executeClearCloudData,
  executeCompleteGoogleOAuth,
  executeConnectGoogleDrive,
  executeDisconnectCloud,
  executeDownloadRemoteBook,
  executeEvictLocalBook,
  executeRefreshSyncStatus,
  executeSetSyncInterval,
  executeSyncNow,
} from '@hooks/useCloudSync';
import { useHighlightStore } from '@stores/useHighlightStore';
import { useLibraryStore } from '@stores/useLibraryStore';
import { useSyncStore } from '@stores/useSyncStore';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MockBackend } from '../../mocks/MockBackend';

function createMockSyncService() {
  let currentStatus: CloudSyncStatus = {
    state: 'idle',
    connected: false,
    providerId: null,
    accountLabel: null,
    intervalSecs: 120,
    lastSyncedAtMs: null,
    lastRevision: 0,
    lastPulledBooks: 0,
    lastPushedBooks: 0,
    lastError: null,
    availableProviders: [
      { id: 'google_drive', displayName: 'Google Drive', authKind: 'oAuthPkce' },
    ],
  };

  const service: ISyncService = {
    listCloudProviders: vi.fn(async () => [...currentStatus.availableProviders]),
    getCloudSyncStatus: vi.fn(async () => currentStatus),
    beginGoogleOAuth: vi.fn(
      async (): Promise<OAuthStartResult> => ({
        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth?client_id=test',
        state: 'state-1',
        redirectUri: 'http://127.0.0.1:42813/oauth/callback',
      })
    ),
    completeGoogleOAuth: vi.fn(async () => {
      currentStatus = {
        ...currentStatus,
        connected: true,
        providerId: 'google_drive',
        accountLabel: 'reader@example.com',
      };
      return currentStatus;
    }),
    connectGoogleDrive: vi.fn(async () => {
      currentStatus = {
        ...currentStatus,
        connected: true,
        providerId: 'google_drive',
        accountLabel: 'reader@example.com',
      };
      return currentStatus;
    }),
    disconnectCloudProvider: vi.fn(async () => {
      currentStatus = {
        ...currentStatus,
        connected: false,
        providerId: null,
        accountLabel: null,
      };
      return currentStatus;
    }),
    triggerCloudSync: vi.fn(
      async (): Promise<SyncReport> => ({
        revision: 2,
        pulledBooks: 1,
        pushedBooks: 0,
        uploadedBlobs: 0,
        downloadedCovers: 1,
        deletedBooks: 0,
        retries: 0,
        syncedAtMs: 5_000,
      })
    ),
    notifyAppResumed: vi.fn(async () => null),
    setCloudSyncInterval: vi.fn(async (intervalSecs: number) => {
      currentStatus = { ...currentStatus, intervalSecs };
      return currentStatus;
    }),
    listBookAvailabilities: vi.fn(
      async (): Promise<Record<string, BookAvailability>> => ({
        'sha256-sync-book': 'remoteOnly',
      })
    ),
    downloadRemoteBook: vi.fn(async () => true),
    evictLocalBook: vi.fn(async () => true),
    clearCloudSyncData: vi.fn(async () => 4),
    subscribeStatus: vi.fn(async () => () => {}),
  };

  return service;
}

describe('useCloudSync controllers & store', () => {
  const sampleBook: BookMetadata = {
    bookHash: 'sha256-sync-book',
    title: 'Synced Book',
    author: 'Plato',
    format: BookFormat.EPUB,
    currentPage: 10,
    totalPages: 100,
    percentage: 10,
    tags: [],
    lastReadAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  };

  const sampleHighlight = new Highlight(
    'hl-sync-1',
    'sha256-sync-book',
    'Excerpt',
    '#FDE047',
    { format: BookFormat.EPUB, pageNumber: 10, epubCfi: 'epubcfi(/6/2!/4/2)' },
    'Note'
  );

  beforeEach(() => {
    useSyncStore.getState().reset();
    useLibraryStore.getState().reset();
    useHighlightStore.getState().reset();
  });

  it('connects, syncs, rehydrates stores, manages on-demand downloads, and disconnects', async () => {
    const backend = new MockBackend([sampleBook], [sampleHighlight]);
    const service = createMockSyncService();

    await executeRefreshSyncStatus(service);
    expect(useSyncStore.getState().status?.connected).toBe(false);
    expect(useSyncStore.getState().availabilities['sha256-sync-book']).toBe('remoteOnly');

    const authUrl = await executeBeginGoogleOAuth(service, 'custom-client');
    expect(authUrl).toContain('accounts.google.com');
    expect(useSyncStore.getState().pendingAuthUrl).toBe(authUrl);

    await executeCompleteGoogleOAuth(service, 'code-123');
    expect(useSyncStore.getState().status?.connected).toBe(true);
    expect(useSyncStore.getState().pendingAuthUrl).toBeNull();

    await executeSetSyncInterval(service, 300);
    expect(useSyncStore.getState().status?.intervalSecs).toBe(300);

    await executeSyncNow(service, backend, backend);
    expect(useLibraryStore.getState().books).toHaveLength(1);
    expect(useHighlightStore.getState().highlights).toHaveLength(1);

    await executeDownloadRemoteBook(service, 'sha256-sync-book');
    expect(useSyncStore.getState().availabilities['sha256-sync-book']).toBe('local');
    expect(useSyncStore.getState().downloadingHashes['sha256-sync-book']).toBe(false);

    await executeEvictLocalBook(service, 'sha256-sync-book');
    expect(useSyncStore.getState().availabilities['sha256-sync-book']).toBe('remoteOnly');

    expect(await executeClearCloudData(service)).toBe(4);

    await executeDisconnectCloud(service);
    expect(useSyncStore.getState().status?.connected).toBe(false);

    await executeConnectGoogleDrive(service);
    expect(useSyncStore.getState().status?.connected).toBe(true);
  });

  it('captures errors cleanly in useSyncStore without throwing', async () => {
    const service = createMockSyncService();
    vi.mocked(service.beginGoogleOAuth).mockRejectedValueOnce(new Error('Missing client ID'));

    const url = await executeBeginGoogleOAuth(service);
    expect(url).toBeNull();
    expect(useSyncStore.getState().error).toBe('Missing client ID');
  });
});
