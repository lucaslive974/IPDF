import type { BookMetadata } from '@domain/BookMetadata';
import { BookFormat } from '@domain/types';
import {
  DEFAULT_STARTUP_MIN_DISPLAY_MS,
  executeAppStartup,
  formatStartupError,
} from '@hooks/useAppStartup';
import { useLibraryStore } from '@stores/useLibraryStore';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MockBackend } from '../../mocks/MockBackend';

describe('useAppStartup', () => {
  const sampleBook: BookMetadata = {
    bookHash: 'sha256-republic',
    title: 'The Republic',
    author: 'Plato',
    format: BookFormat.EPUB,
    currentPage: 12,
    totalPages: 320,
    percentage: 3.75,
    tags: ['philosophy'],
    lastReadAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  };

  let backend: MockBackend;

  beforeEach(() => {
    backend = new MockBackend([sampleBook]);
    useLibraryStore.getState().reset();
  });

  it('defaults minimum display duration to 5000ms', () => {
    expect(DEFAULT_STARTUP_MIN_DISPLAY_MS).toBe(5000);
  });

  it('runs healthcheck, platform check, and library hydration in parallel', async () => {
    const healthSpy = vi.spyOn(backend, 'healthcheck');
    const platformSpy = vi.spyOn(backend, 'getPlatformInfo');
    const listSpy = vi.spyOn(backend, 'listLibraryBooks');
    const setBooks = vi.fn((books: readonly BookMetadata[]) => {
      useLibraryStore.getState().setBooks(books);
    });

    const result = await executeAppStartup({
      settingsService: backend,
      libraryService: backend,
      setBooks,
    });

    expect(healthSpy).toHaveBeenCalledTimes(1);
    expect(platformSpy).toHaveBeenCalledTimes(1);
    expect(listSpy).toHaveBeenCalledTimes(1);
    expect(setBooks).toHaveBeenCalledWith([sampleBook]);
    expect(useLibraryStore.getState().books).toEqual([sampleBook]);
    expect(result.healthMessage).toBe('Scholarium Mock Backend Active');
    expect(result.platformInfo.databasePath).toContain('scholarium.db');
    expect(result.books).toEqual([sampleBook]);
  });

  it('throws when backend healthcheck returns an empty response', async () => {
    vi.spyOn(backend, 'healthcheck').mockResolvedValue('   ');
    const setBooks = vi.fn();

    await expect(
      executeAppStartup({
        settingsService: backend,
        libraryService: backend,
        setBooks,
      })
    ).rejects.toThrow('Backend health check returned an empty response');
    expect(setBooks).not.toHaveBeenCalled();
  });

  it('throws when platform info does not resolve a database path', async () => {
    vi.spyOn(backend, 'getPlatformInfo').mockResolvedValue({
      platform: 'Linux',
      configDir: '/mock/config',
      dataDir: '/mock/data',
      cacheDir: '/mock/cache',
      databasePath: '',
      supportsDiscordPresence: true,
    });
    const setBooks = vi.fn();

    await expect(
      executeAppStartup({
        settingsService: backend,
        libraryService: backend,
        setBooks,
      })
    ).rejects.toThrow('Database path is unavailable');
    expect(setBooks).not.toHaveBeenCalled();
  });

  it('propagates IPC failures cleanly without hydrating partial state', async () => {
    vi.spyOn(backend, 'listLibraryBooks').mockRejectedValue(new Error('SQLite lock timeout'));
    const setBooks = vi.fn();

    await expect(
      executeAppStartup({
        settingsService: backend,
        libraryService: backend,
        setBooks,
      })
    ).rejects.toThrow('SQLite lock timeout');
    expect(setBooks).not.toHaveBeenCalled();
  });

  it('formats Error instances and unknown values into readable messages', () => {
    expect(formatStartupError(new Error('Connection refused'))).toBe('Connection refused');
    expect(formatStartupError('Custom failure')).toBe('Custom failure');
    expect(formatStartupError({ code: 500 })).toBe(
      'Unable to initialize Scholarium backend services.'
    );
  });
});
