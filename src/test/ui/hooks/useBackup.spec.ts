import type { BookMetadata } from '@domain/BookMetadata';
import { Highlight } from '@domain/Highlight';
import { BookFormat } from '@domain/types';
import {
  executeCreateBackup,
  executeImportBackup,
  executeRestoreBackup,
  formatBackupDeviceLabel,
  formatBackupPlatform,
  formatBackupReportSummary,
  formatBackupSize,
} from '@hooks/useBackup';
import { useHighlightStore } from '@stores/useHighlightStore';
import { useLibraryStore } from '@stores/useLibraryStore';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MockBackend } from '../../mocks/MockBackend';

describe('useBackup helpers & controllers', () => {
  const sampleBook: BookMetadata = {
    bookHash: 'sha256-backup-book',
    title: 'Backup Book',
    author: 'Author',
    format: BookFormat.EPUB,
    currentPage: 5,
    totalPages: 120,
    percentage: 4.16,
    tags: [],
    lastReadAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  };

  const sampleHighlight = new Highlight(
    'hl-backup-1',
    'sha256-backup-book',
    'Important passage',
    '#f59e0b',
    { format: BookFormat.EPUB, pageNumber: 5, epubCfi: 'epubcfi(/6/2!/4/2)' },
    'Note'
  );

  let backend: MockBackend;

  beforeEach(() => {
    backend = new MockBackend([sampleBook], [sampleHighlight]);
    useLibraryStore.getState().reset();
    useHighlightStore.getState().reset();
  });

  it('formats byte sizes and backup report summaries cleanly', () => {
    expect(formatBackupSize(512)).toBe('512 B');
    expect(formatBackupSize(2048)).toBe('2.0 KB');
    expect(formatBackupSize(5 * 1024 * 1024)).toBe('5.0 MB');

    expect(
      formatBackupReportSummary('Backup created', {
        booksCount: 2,
        coversCount: 1,
        includesDatabase: true,
        totalBytes: 2048,
      })
    ).toBe('Backup created: 2 books, 1 cover (2.0 KB)');

    expect(formatBackupDeviceLabel('lucas_notebook')).toBe('Lucas Notebook');
    expect(formatBackupDeviceLabel('')).toBe('Unknown Device');
    expect(formatBackupPlatform('linux')).toBe('Linux');
    expect(formatBackupPlatform('ios')).toBe('iOS');
  });

  it('creates a backup and refreshes artifact list', async () => {
    const createSpy = vi.spyOn(backend, 'createLocalBackup');
    const result = await executeCreateBackup(backend);

    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(result.artifact.name).toMatch(/^scholarium-backup-.*\.zip$/);
    expect(result.report.booksCount).toBe(1);

    const listed = await backend.listLocalBackups();
    expect(listed).toHaveLength(1);
    expect(listed[0]?.id).toBe(result.artifact.id);
  });

  it('restores a backup and rehydrates library and highlight stores', async () => {
    const { artifact } = await executeCreateBackup(backend);

    await backend.resetApplicationData();
    expect(await backend.listLibraryBooks()).toHaveLength(0);
    expect(await backend.loadAllHighlights()).toHaveLength(0);

    const report = await executeRestoreBackup({
      backupId: artifact.id,
      backupService: backend,
      libraryService: backend,
      highlightService: backend,
      setBooks: useLibraryStore.getState().setBooks,
      setHighlights: useHighlightStore.getState().setHighlights,
    });

    expect(report.booksCount).toBe(1);
    expect(useLibraryStore.getState().books).toHaveLength(1);
    expect(useHighlightStore.getState().highlights).toHaveLength(1);
  });

  it('exports and imports backups via file dialog port and rehydrates stores', async () => {
    const { artifact } = await executeCreateBackup(backend);
    const exportedPath = await backend.exportLocalBackup(artifact.id);
    expect(exportedPath).toContain(artifact.id);

    await backend.resetApplicationData();
    useLibraryStore.getState().reset();
    useHighlightStore.getState().reset();

    const imported = await executeImportBackup({
      backupService: backend,
      libraryService: backend,
      highlightService: backend,
      setBooks: useLibraryStore.getState().setBooks,
      setHighlights: useHighlightStore.getState().setHighlights,
    });

    expect(imported?.booksCount).toBe(1);
    expect(useLibraryStore.getState().books).toHaveLength(1);
    expect(useHighlightStore.getState().highlights).toHaveLength(1);
  });
});
