import { TauriSyncService } from '@adapters/ipc/TauriSyncService';
import { describe, expect, it, vi } from 'vitest';

const mockInvoke = vi.fn(async (cmd: string, args?: Record<string, unknown>) => {
  switch (cmd) {
    case 'list_cloud_providers':
      return [{ id: 'google_drive', displayName: 'Google Drive', authKind: 'oAuthPkce' }];
    case 'get_cloud_sync_status':
    case 'complete_google_oauth':
    case 'connect_google_drive':
    case 'disconnect_cloud_provider':
    case 'set_cloud_sync_interval':
      return {
        state: 'idle',
        connected: cmd === 'complete_google_oauth' || cmd === 'connect_google_drive',
        providerId:
          cmd === 'complete_google_oauth' || cmd === 'connect_google_drive' ? 'google_drive' : null,
        accountLabel: null,
        intervalSecs: Number(args?.intervalSecs ?? 120),
        lastSyncedAtMs: null,
        lastRevision: 0,
        lastPulledBooks: 0,
        lastPushedBooks: 0,
        lastError: null,
        availableProviders: [],
      };
    case 'begin_google_oauth':
      return {
        authUrl: 'https://accounts.google.com/auth',
        state: 'st-1',
        redirectUri: 'http://127.0.0.1:42813/oauth/callback',
      };
    case 'trigger_cloud_sync':
    case 'notify_app_resumed':
      return {
        revision: 1,
        pulledBooks: 0,
        pushedBooks: 1,
        uploadedBlobs: 1,
        downloadedCovers: 0,
        deletedBooks: 0,
        retries: 0,
        syncedAtMs: 1_000,
      };
    case 'list_book_availabilities':
      return { 'hash-1': 'local' };
    case 'download_remote_book':
    case 'evict_local_book':
      return true;
    case 'clear_cloud_sync_data':
      return 3;
    default:
      throw new Error(`Unexpected command: ${cmd}`);
  }
});

const mockListen = vi.fn(async (_event: string, cb: (event: { payload: unknown }) => void) => {
  cb({
    payload: {
      state: 'synced',
      connected: true,
      providerId: 'google_drive',
      accountLabel: null,
      intervalSecs: 120,
      lastSyncedAtMs: 1_000,
      lastRevision: 2,
      lastPulledBooks: 0,
      lastPushedBooks: 0,
      lastError: null,
      availableProviders: [],
    },
  });
  return () => {};
});

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (cmd: string, args?: Record<string, unknown>) => mockInvoke(cmd, args),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: (event: string, cb: (event: { payload: unknown }) => void) => mockListen(event, cb),
}));

describe('TauriSyncService', () => {
  it('routes all cloud sync and on-demand storage commands through Tauri IPC', async () => {
    const svc = new TauriSyncService();

    expect(await svc.listCloudProviders()).toHaveLength(1);
    expect((await svc.getCloudSyncStatus()).intervalSecs).toBe(120);
    expect((await svc.beginGoogleOAuth('cid')).authUrl).toContain('google.com');
    expect((await svc.completeGoogleOAuth('code-1')).connected).toBe(true);
    expect((await svc.connectGoogleDrive()).connected).toBe(true);
    expect((await svc.triggerCloudSync()).revision).toBe(1);
    expect((await svc.notifyAppResumed())?.revision).toBe(1);
    expect((await svc.setCloudSyncInterval(300)).intervalSecs).toBe(300);
    expect(await svc.listBookAvailabilities()).toEqual({ 'hash-1': 'local' });
    expect(await svc.downloadRemoteBook('hash-1')).toBe(true);
    expect(await svc.evictLocalBook('hash-1')).toBe(true);
    expect(await svc.clearCloudSyncData()).toBe(3);
    expect((await svc.disconnectCloudProvider()).connected).toBe(false);

    const received: number[] = [];
    const unlisten = await svc.subscribeStatus((status) => {
      received.push(status.lastRevision);
    });
    expect(received).toEqual([2]);
    unlisten();
  });
});
