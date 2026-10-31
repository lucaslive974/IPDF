import { describe, expect, it } from 'vitest';
import { CachedStorageDecorator } from '../../../src/adapters/storage/CachedStorageDecorator';
import { InMemoryStorageProvider } from '../../fakes/InMemoryStorageProvider';

describe('CachedStorageDecorator', () => {
  it('transparently caches book binaries on demand from primary storage into local cache', async () => {
    const localCache = new InMemoryStorageProvider('local-cache');
    const primaryCloud = new InMemoryStorageProvider('google-drive');
    const decorated = new CachedStorageDecorator(localCache, primaryCloud);

    await decorated.initialize();
    expect(decorated.isAvailable()).toBe(true);
    expect(decorated.providerId).toBe('cached:google-drive');

    const sampleBinary = new Uint8Array([1, 2, 3, 4, 5]).buffer;
    await primaryCloud.writeBookBinary('hash-republic', sampleBinary, 'epub');

    expect(await localCache.hasBookBinary('hash-republic')).toBe(false);
    expect(await decorated.hasBookBinary('hash-republic')).toBe(true);

    // First read pulls from primaryCloud and populates localCache
    const firstRead = await decorated.readBookBinary('hash-republic');
    expect(new Uint8Array(firstRead)).toEqual(new Uint8Array([1, 2, 3, 4, 5]));
    expect(primaryCloud.readBinaryCount).toBe(1);
    expect(await localCache.hasBookBinary('hash-republic')).toBe(true);

    // Second read is served directly from localCache without hitting primaryCloud
    const secondRead = await decorated.readBookBinary('hash-republic');
    expect(new Uint8Array(secondRead)).toEqual(new Uint8Array([1, 2, 3, 4, 5]));
    expect(primaryCloud.readBinaryCount).toBe(1);
    expect(localCache.readBinaryCount).toBe(1);
  });

  it('falls back to local cache for entries and binaries when primary storage is offline', async () => {
    const localCache = new InMemoryStorageProvider('local-cache');
    const primaryCloud = new InMemoryStorageProvider('google-drive');
    const decorated = new CachedStorageDecorator(localCache, primaryCloud);

    await decorated.writeBookBinary('hash-offline', new Uint8Array([9, 8, 7]).buffer, 'pdf');
    await decorated.writeEntry('index.json', '{"ok":true}', 'application/json');

    // Simulate offline primary storage
    primaryCloud.setAvailable(false);

    expect(await decorated.hasBookBinary('hash-offline')).toBe(true);
    expect(await decorated.hasBookBinary('non-existent')).toBe(false);

    const entries = await decorated.listEntries();
    expect(entries).toHaveLength(1);

    const entryBytes = await decorated.readEntry('index.json');
    expect(new TextDecoder().decode(entryBytes ?? new Uint8Array())).toBe('{"ok":true}');
  });
});
