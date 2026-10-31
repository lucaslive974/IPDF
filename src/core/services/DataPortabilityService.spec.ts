import { describe, expect, it } from 'vitest';
import { InMemoryBookRepository } from '../../test/fakes/InMemoryBookRepository';
import { InMemoryFileStorage } from '../../test/fakes/InMemoryFileStorage';
import { InMemoryHighlightRepository } from '../../test/fakes/InMemoryHighlightRepository';
import { JsonExportStrategy } from '../../test/fakes/JsonExportStrategy';
import type { BookMetadata } from '../domain/BookMetadata';
import { Highlight } from '../domain/Highlight';
import { DataPortabilityService } from './DataPortabilityService';

const makeBook = (hash: string, page: number, updatedAt: Date): BookMetadata => ({
  bookHash: hash,
  title: 'Meditations',
  author: 'Marcus Aurelius',
  format: 'epub',
  currentPage: page,
  totalPages: 200,
  percentage: page / 2,
  isDownloadedLocally: true,
  lastReadAt: updatedAt,
  updatedAt,
});

describe('DataPortabilityService', () => {
  it('omits book binaries when exporting with includeBookFiles: false', async () => {
    const bookRepo = new InMemoryBookRepository();
    const highlightRepo = new InMemoryHighlightRepository();
    const fileStorage = new InMemoryFileStorage();
    const strategy = new JsonExportStrategy();

    const now = new Date('2026-02-01T12:00:00Z');
    await bookRepo.save(makeBook('hash-meditations', 20, now));
    await fileStorage.writeBookBinary(
      'hash-meditations',
      new Uint8Array([1, 2, 3, 4]).buffer,
      'epub'
    );

    const service = new DataPortabilityService(bookRepo, highlightRepo, fileStorage);
    const exportedRaw = await service.exportData(
      { includeBookFiles: false, format: 'json-only' },
      strategy
    );

    const deserialized = await strategy.deserialize(exportedRaw);
    expect(deserialized.books).toHaveLength(1);
    expect(deserialized.binaries).toBeUndefined();
  });

  it('updates local records under last-write-wins only when incoming.updatedAt > local.updatedAt', async () => {
    const bookRepo = new InMemoryBookRepository();
    const highlightRepo = new InMemoryHighlightRepository();
    const fileStorage = new InMemoryFileStorage();
    const strategy = new JsonExportStrategy();

    const t1 = new Date('2026-02-01T10:00:00Z');
    const t2 = new Date('2026-02-01T12:00:00Z');
    const t3 = new Date('2026-02-01T14:00:00Z');

    // Local state at t2
    await bookRepo.save(makeBook('hash-1', 50, t2));
    await highlightRepo.save(
      new Highlight(
        'hl-older-incoming',
        'hash-1',
        'Quote 1',
        '#eab308',
        { format: 'epub', pageNumber: 10, epubCfi: 'cfi-1' },
        'Local newer note',
        t1,
        t2
      )
    );
    await highlightRepo.save(
      new Highlight(
        'hl-newer-incoming',
        'hash-1',
        'Quote 2',
        '#eab308',
        { format: 'epub', pageNumber: 11, epubCfi: 'cfi-2' },
        'Local older note',
        t1,
        t2
      )
    );

    const incomingPayload = await strategy.serialize({
      schemaVersion: 1,
      exportedAt: t3,
      deviceId: 'remote-device',
      books: [makeBook('hash-1', 80, t3)], // newer than local t2 -> should update
      highlights: [
        new Highlight(
          'hl-older-incoming',
          'hash-1',
          'Quote 1',
          '#ef4444',
          { format: 'epub', pageNumber: 10, epubCfi: 'cfi-1' },
          'Stale remote note',
          t1,
          t1 // older than local t2 -> should NOT update
        ),
        new Highlight(
          'hl-newer-incoming',
          'hash-1',
          'Quote 2',
          '#22c55e',
          { format: 'epub', pageNumber: 11, epubCfi: 'cfi-2' },
          'Fresh remote note',
          t1,
          t3 // newer than local t2 -> should update
        ),
        new Highlight(
          'hl-brand-new',
          'hash-1',
          'Quote 3',
          '#3b82f6',
          { format: 'epub', pageNumber: 12, epubCfi: 'cfi-3' },
          'New highlight',
          t3,
          t3
        ),
      ],
    });

    const service = new DataPortabilityService(bookRepo, highlightRepo, fileStorage);
    const report = await service.importData(incomingPayload, strategy, 'last-write-wins');

    expect(report.booksUpdated).toBe(1);
    expect(report.highlightsUpdated).toBe(1);
    expect(report.highlightsAdded).toBe(1);
    expect(report.conflictsResolved).toBe(3);

    const updatedBook = await bookRepo.findById('hash-1');
    expect(updatedBook?.currentPage).toBe(80);

    const keptLocalHighlight = await highlightRepo.findById('hl-older-incoming');
    expect(keptLocalHighlight?.note).toBe('Local newer note');

    const updatedRemoteHighlight = await highlightRepo.findById('hl-newer-incoming');
    expect(updatedRemoteHighlight?.note).toBe('Fresh remote note');
  });

  it('restores missing binaries without overwriting existing local binary files', async () => {
    const bookRepo = new InMemoryBookRepository();
    const highlightRepo = new InMemoryHighlightRepository();
    const fileStorage = new InMemoryFileStorage();
    const strategy = new JsonExportStrategy();

    const now = new Date('2026-02-01T12:00:00Z');
    const existingBytes = new Uint8Array([10, 20, 30]).buffer;
    await fileStorage.writeBookBinary('book-existing', existingBytes, 'epub');

    const incomingRaw = await strategy.serialize({
      schemaVersion: 1,
      exportedAt: now,
      deviceId: 'remote-device',
      books: [makeBook('book-existing', 10, now), makeBook('book-missing', 5, now)],
      highlights: [],
      binaries: new Map<string, ArrayBuffer>([
        ['book-existing', new Uint8Array([99, 99, 99]).buffer],
        ['book-missing', new Uint8Array([42, 43, 44]).buffer],
      ]),
    });

    const service = new DataPortabilityService(bookRepo, highlightRepo, fileStorage);
    const report = await service.importData(incomingRaw, strategy, 'last-write-wins');

    expect(report.binariesRestored).toBe(1);

    const preserved = new Uint8Array(await fileStorage.readBookBinary('book-existing'));
    expect(Array.from(preserved)).toEqual([10, 20, 30]);

    const restored = new Uint8Array(await fileStorage.readBookBinary('book-missing'));
    expect(Array.from(restored)).toEqual([42, 43, 44]);
  });
});
