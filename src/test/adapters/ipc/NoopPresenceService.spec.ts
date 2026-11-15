import { NoopPresenceService } from '@adapters/ipc/NoopPresenceService';
import { describe, expect, it } from 'vitest';

describe('NoopPresenceService', () => {
  it('resolves all presence methods without invoking IPC', async () => {
    const service = new NoopPresenceService();

    await expect(service.setDiscordPresenceEnabled(true)).resolves.toBeUndefined();
    await expect(service.clearRichPresence()).resolves.toBeUndefined();
    await expect(service.updateLibraryPresence(10)).resolves.toBeUndefined();
    await expect(service.updateAnnotationsPresence(5)).resolves.toBeUndefined();
    await expect(
      service.updateReadingPresence({
        bookHash: 'hash-1',
        bookTitle: 'Test Book',
        bookAuthor: 'Author',
        currentPage: 1,
        totalPages: 10,
      })
    ).resolves.toBeUndefined();

    const health = await service.getDiscordPresenceHealth();
    expect(health.ok).toBe(false);
    expect(health.message).toContain('mobile');
  });
});
