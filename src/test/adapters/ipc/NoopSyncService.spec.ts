import { NoopSyncService } from '@adapters/ipc/NoopSyncService';
import { describe, expect, it } from 'vitest';

describe('NoopSyncService', () => {
  it('returns safe disabled defaults without invoking IPC', async () => {
    const service = new NoopSyncService();

    await expect(service.listCloudProviders()).resolves.toEqual([]);
    const status = await service.getCloudSyncStatus();
    expect(status.connected).toBe(false);
    expect(status.availableProviders).toEqual([]);

    await expect(service.beginGoogleOAuth()).rejects.toThrow('disabled');
    await expect(service.completeGoogleOAuth('code')).rejects.toThrow('disabled');
    await expect(service.connectGoogleDrive()).rejects.toThrow('disabled');

    await expect(service.disconnectCloudProvider()).resolves.toEqual(status);
    await expect(service.triggerCloudSync()).resolves.toMatchObject({ revision: 0 });
    await expect(service.notifyAppResumed()).resolves.toBeNull();
    await expect(service.setCloudSyncInterval(60)).resolves.toEqual(status);
    await expect(service.listBookAvailabilities()).resolves.toEqual({});
    await expect(service.downloadRemoteBook('hash-1')).resolves.toBe(false);
    await expect(service.evictLocalBook('hash-1')).resolves.toBe(false);
    await expect(service.clearCloudSyncData()).resolves.toBe(0);

    const unsubscribe = await service.subscribeStatus(() => {});
    expect(typeof unsubscribe).toBe('function');
    unsubscribe();
  });
});
