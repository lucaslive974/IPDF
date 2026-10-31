import { describe, expect, it } from 'vitest';
import { InMemoryBookRepository } from '../../test/fakes/InMemoryBookRepository';
import { InMemoryFileStorage } from '../../test/fakes/InMemoryFileStorage';
import { InMemoryHighlightRepository } from '../../test/fakes/InMemoryHighlightRepository';
import { InMemoryRemoteStorageProvider } from '../../test/fakes/InMemoryRemoteStorageProvider';
import { JsonExportStrategy } from '../../test/fakes/JsonExportStrategy';
import { Highlight } from '../domain/Highlight';
import { CloudlessSyncEngine } from './CloudlessSyncEngine';
import { DataPortabilityService } from './DataPortabilityService';

describe('CloudlessSyncEngine', () => {
  it('downloads <bookHash>.highlights.json, merges via DataPortabilityService (LWW), and uploads the updated JSON', async () => {
    const bookRepo = new InMemoryBookRepository();
    const highlightRepo = new InMemoryHighlightRepository();
    const fileStorage = new InMemoryFileStorage();
    const remoteStorage = new InMemoryRemoteStorageProvider();
    const jsonStrategy = new JsonExportStrategy();

    const t1 = new Date('2026-03-10T10:00:00Z');
    const t2 = new Date('2026-03-10T12:00:00Z');

    // Local highlight
    await highlightRepo.save(
      new Highlight(
        'hl-local',
        'book-phaedo',
        'Local passage',
        '#eab308',
        { format: 'epub', pageNumber: 4, epubCfi: 'cfi-local' },
        'Local note',
        t1,
        t2
      )
    );

    // Pre-existing remote file with another highlight and an older version of hl-local
    const remoteInitialJson = await jsonStrategy.serialize({
      schemaVersion: 1,
      exportedAt: t1,
      deviceId: 'ipad-device',
      books: [],
      highlights: [
        new Highlight(
          'hl-local',
          'book-phaedo',
          'Local passage',
          '#eab308',
          { format: 'epub', pageNumber: 4, epubCfi: 'cfi-local' },
          'Outdated remote note',
          t1,
          t1
        ),
        new Highlight(
          'hl-remote-new',
          'book-phaedo',
          'Remote passage from iPad',
          '#3b82f6',
          { format: 'epub', pageNumber: 9, epubCfi: 'cfi-remote' },
          'iPad note',
          t2,
          t2
        ),
      ],
    });

    await remoteStorage.uploadFile(
      'book-phaedo.highlights.json',
      remoteInitialJson,
      'application/json'
    );

    const portabilityService = new DataPortabilityService(bookRepo, highlightRepo, fileStorage);
    const syncEngine = new CloudlessSyncEngine(remoteStorage, portabilityService, jsonStrategy);

    await syncEngine.syncBookState('book-phaedo');

    // Local repository now has both highlights, and hl-local preserved its newer note
    const localHighlights = await highlightRepo.findByBook('book-phaedo');
    expect(localHighlights).toHaveLength(2);
    const mergedLocal = await highlightRepo.findById('hl-local');
    expect(mergedLocal?.note).toBe('Local note');

    // Remote file was updated with the merged state
    const remoteEntry = await remoteStorage.findFileByName('book-phaedo.highlights.json');
    expect(remoteEntry).not.toBeNull();
    if (!remoteEntry) {
      throw new Error('Expected remoteEntry to exist');
    }
    const uploadedBytes = await remoteStorage.downloadFile(remoteEntry.id);
    const uploadedPayload = await jsonStrategy.deserialize(uploadedBytes);
    expect(uploadedPayload.highlights).toHaveLength(2);
  });

  it('silently ignores execution without throwing an error when isAuthenticated() is false', async () => {
    const bookRepo = new InMemoryBookRepository();
    const highlightRepo = new InMemoryHighlightRepository();
    const fileStorage = new InMemoryFileStorage();
    const remoteStorage = new InMemoryRemoteStorageProvider();
    remoteStorage.setAuthenticated(false);

    const jsonStrategy = new JsonExportStrategy();
    const portabilityService = new DataPortabilityService(bookRepo, highlightRepo, fileStorage);
    const syncEngine = new CloudlessSyncEngine(remoteStorage, portabilityService, jsonStrategy);

    await expect(syncEngine.syncBookState('book-phaedo')).resolves.toBeUndefined();
    await expect(syncEngine.syncLibraryIndex()).resolves.toBeUndefined();
    expect(remoteStorage.uploadCount).toBe(0);
    expect(remoteStorage.downloadCount).toBe(0);
  });

  it('synchronizes .reader_library_index.json via syncLibraryIndex()', async () => {
    const bookRepo = new InMemoryBookRepository();
    const highlightRepo = new InMemoryHighlightRepository();
    const fileStorage = new InMemoryFileStorage();
    const remoteStorage = new InMemoryRemoteStorageProvider();
    const jsonStrategy = new JsonExportStrategy();

    const now = new Date('2026-03-10T15:00:00Z');
    const initialIndex = await jsonStrategy.serialize({
      schemaVersion: 1,
      exportedAt: now,
      deviceId: 'desktop',
      books: [
        {
          bookHash: 'book-1',
          title: 'Ethics',
          author: 'Spinoza',
          format: 'pdf',
          currentPage: 12,
          totalPages: 300,
          percentage: 4,
          isDownloadedLocally: false,
          lastReadAt: now,
          updatedAt: now,
        },
      ],
      highlights: [],
    });

    await remoteStorage.uploadFile('.reader_library_index.json', initialIndex, 'application/json');

    const portabilityService = new DataPortabilityService(bookRepo, highlightRepo, fileStorage);
    const syncEngine = new CloudlessSyncEngine(remoteStorage, portabilityService, jsonStrategy);

    await syncEngine.syncLibraryIndex();

    const importedBook = await bookRepo.findById('book-1');
    expect(importedBook?.title).toBe('Ethics');
  });
});
