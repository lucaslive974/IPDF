import { describe, expect, it } from 'vitest';
import { Highlight } from '../../../src/core/domain/Highlight';
import { CloudlessSyncEngine } from '../../../src/core/services/CloudlessSyncEngine';
import { DataPortabilityService } from '../../../src/core/services/DataPortabilityService';
import { InMemoryBookRepository } from '../../fakes/InMemoryBookRepository';
import { InMemoryHighlightRepository } from '../../fakes/InMemoryHighlightRepository';
import { InMemoryStorageProvider } from '../../fakes/InMemoryStorageProvider';
import { JsonExportStrategy } from '../../fakes/JsonExportStrategy';

describe('CloudlessSyncEngine', () => {
  it('reads <bookHash>.highlights.json from IStorageProvider, merges via DataPortabilityService (LWW), and writes the updated JSON', async () => {
    const bookRepo = new InMemoryBookRepository();
    const highlightRepo = new InMemoryHighlightRepository();
    const storage = new InMemoryStorageProvider();
    const jsonStrategy = new JsonExportStrategy();

    const t1 = new Date('2026-03-10T10:00:00Z');
    const t2 = new Date('2026-03-10T12:00:00Z');

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

    await storage.writeEntry('book-phaedo.highlights.json', remoteInitialJson, 'application/json');

    const portabilityService = new DataPortabilityService(bookRepo, highlightRepo, storage);
    const syncEngine = new CloudlessSyncEngine(storage, portabilityService, jsonStrategy);

    await syncEngine.syncBookState('book-phaedo');

    const localHighlights = await highlightRepo.findByBook('book-phaedo');
    expect(localHighlights).toHaveLength(2);
    const mergedLocal = await highlightRepo.findById('hl-local');
    expect(mergedLocal?.note).toBe('Local note');

    const uploadedBytes = await storage.readEntry('book-phaedo.highlights.json');
    expect(uploadedBytes).not.toBeNull();
    if (!uploadedBytes) {
      throw new Error('Expected uploadedBytes to exist');
    }
    const uploadedPayload = await jsonStrategy.deserialize(uploadedBytes);
    expect(uploadedPayload.highlights).toHaveLength(2);
  });

  it('silently ignores execution without throwing an error when isAvailable() is false', async () => {
    const bookRepo = new InMemoryBookRepository();
    const highlightRepo = new InMemoryHighlightRepository();
    const storage = new InMemoryStorageProvider();
    storage.setAvailable(false);

    const jsonStrategy = new JsonExportStrategy();
    const portabilityService = new DataPortabilityService(bookRepo, highlightRepo, storage);
    const syncEngine = new CloudlessSyncEngine(storage, portabilityService, jsonStrategy);

    await expect(syncEngine.syncBookState('book-phaedo')).resolves.toBeUndefined();
    await expect(syncEngine.syncLibraryIndex()).resolves.toBeUndefined();
    expect(storage.writeEntryCount).toBe(0);
    expect(storage.readEntryCount).toBe(0);
  });

  it('synchronizes .reader_library_index.json via syncLibraryIndex()', async () => {
    const bookRepo = new InMemoryBookRepository();
    const highlightRepo = new InMemoryHighlightRepository();
    const storage = new InMemoryStorageProvider();
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
          lastReadAt: now,
          updatedAt: now,
        },
      ],
      highlights: [],
    });

    await storage.writeEntry('.reader_library_index.json', initialIndex, 'application/json');

    const portabilityService = new DataPortabilityService(bookRepo, highlightRepo, storage);
    const syncEngine = new CloudlessSyncEngine(storage, portabilityService, jsonStrategy);

    await syncEngine.syncLibraryIndex();

    const importedBook = await bookRepo.findById('book-1');
    expect(importedBook?.title).toBe('Ethics');
  });
});
