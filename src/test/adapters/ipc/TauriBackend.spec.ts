import {
  type SerializedBookMetadata,
  type SerializedHighlight,
  TauriHighlightService,
  TauriLibraryService,
  TauriPresenceService,
  TauriReaderService,
  TauriSettingsService,
  resolveCoverUrl,
} from '@adapters/ipc';
import { isValidAuthor } from '@components/library/BookCover';
import { Highlight } from '@domain/Highlight';
import { createAssistedTextAnnotation } from '@domain/RichAnnotation';
import { describe, expect, it, vi } from 'vitest';
import { MockBackend } from '../../mocks/MockBackend';

const storedDtos = new Map<string, SerializedHighlight>();
const storedBooks = new Map<string, SerializedBookMetadata>();
const storedSettings = new Map<string, string>();

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: vi.fn((path: string) => `asset://localhost/${path}`),
  invoke: vi.fn(async <T>(cmd: string, args: Record<string, unknown> = {}) => {
    if (cmd === 'list_library_books') {
      return Array.from(storedBooks.values()) as unknown as T;
    }
    if (cmd === 'import_library_book') {
      const dto: SerializedBookMetadata = {
        bookHash: 'sha256-imported-book',
        title: String(args.title),
        author: String(args.author),
        format: 'epub',
        currentPage: 1,
        totalPages: Number(args.totalPages),
        percentage: 1,
        coverImageUrl: args.coverImageUrl ? String(args.coverImageUrl) : undefined,
        lastReadAtMs: 1_700_000_000_000,
        updatedAtMs: 1_700_000_000_000,
      };
      storedBooks.set(dto.bookHash, dto);
      return dto as unknown as T;
    }
    if (cmd === 'update_book_progress') {
      const payload = ((args as Record<string, unknown>).payload ?? args) as Record<
        string,
        unknown
      >;
      const bookHash = String(payload.bookHash);
      const currentPage = Number(payload.currentPage);
      const totalPages = Number(payload.totalPages);
      const pageOffsetRatio = Number(payload.pageOffsetRatio ?? 0.0);
      const existing = storedBooks.get(bookHash);
      const updated: SerializedBookMetadata = {
        bookHash,
        title: existing?.title ?? 'Book',
        author: existing?.author ?? 'Author',
        format: 'epub',
        currentPage,
        totalPages,
        percentage: (currentPage / totalPages) * 100,
        pageOffsetRatio,
        coverImageUrl: existing?.coverImageUrl,
        lastReadAtMs: 1_700_000_100_000,
        updatedAtMs: 1_700_000_100_000,
      };
      storedBooks.set(bookHash, updated);
      return updated as unknown as T;
    }
    if (cmd === 'rename_book') {
      const bookHash = String(args.bookHash);
      const newTitle = String(args.newTitle);
      const existing = storedBooks.get(bookHash);
      if (!existing) throw new Error(`Book not found: ${bookHash}`);
      const updated: SerializedBookMetadata = {
        ...existing,
        title: newTitle,
        updatedAtMs: 1_700_000_200_000,
      };
      storedBooks.set(bookHash, updated);
      return updated as unknown as T;
    }
    if (cmd === 'update_book_metadata') {
      const bookHash = String(args.bookHash);
      const existing = storedBooks.get(bookHash);
      if (!existing) throw new Error(`Book not found: ${bookHash}`);
      const updated: SerializedBookMetadata = {
        ...existing,
        title: String(args.title),
        author: String(args.author),
        tags: (args.tags as string[]) ?? [],
        description: args.description ? String(args.description) : undefined,
        updatedAtMs: 1_700_000_250_000,
      };
      storedBooks.set(bookHash, updated);
      return updated as unknown as T;
    }
    if (cmd === 'update_book_cover') {
      const bookHash = String(args.bookHash);
      const existing = storedBooks.get(bookHash);
      if (!existing) throw new Error(`Book not found: ${bookHash}`);
      const updated: SerializedBookMetadata = {
        ...existing,
        coverImageUrl: String(args.coverImageUrl),
        updatedAtMs: 1_700_000_300_000,
      };
      storedBooks.set(bookHash, updated);
      return updated as unknown as T;
    }
    if (cmd === 'list_authors') {
      const authors = new Set<string>();
      for (const b of storedBooks.values()) {
        if (isValidAuthor(b.author)) authors.add(b.author);
      }
      return Array.from(authors).sort() as unknown as T;
    }
    if (cmd === 'list_tags') {
      const tags = new Set<string>();
      for (const b of storedBooks.values()) {
        for (const t of b.tags ?? []) tags.add(t);
      }
      return Array.from(tags).sort() as unknown as T;
    }
    if (cmd === 'delete_book') {
      const bookHash = String(args.bookHash);
      const existed = storedBooks.delete(bookHash);
      return existed as unknown as T;
    }
    if (cmd === 'get_startup_book') {
      return null as unknown as T;
    }
    if (cmd === 'open_book_files') {
      const filePaths = (args.filePaths as string[]) ?? [];
      const dtos: SerializedBookMetadata[] = filePaths.map((filePath, idx) => {
        const cleanTitle =
          filePath
            .split('/')
            .pop()
            ?.replace(/\.[^/.]+$/, '') ?? `Opened File ${idx}`;
        return {
          bookHash: filePaths.length === 1 ? 'sha256-opened-file' : `sha256-batch-${cleanTitle}`,
          title: cleanTitle,
          author: 'Unknown',
          format: filePath.endsWith('.pdf') ? 'pdf' : 'epub',
          currentPage: 1,
          totalPages: 120,
          percentage: 1,
          lastReadAtMs: 1_700_000_300_000,
          updatedAtMs: 1_700_000_300_000,
        };
      });
      for (const dto of dtos) {
        storedBooks.set(dto.bookHash, dto);
      }
      return dtos as unknown as T;
    }
    if (cmd === 'open_book_file') {
      const filePath = String(args.filePath);
      const cleanTitle =
        filePath
          .split('/')
          .pop()
          ?.replace(/\.[^/.]+$/, '') ?? 'Opened File';
      const dto: SerializedBookMetadata = {
        bookHash: 'sha256-opened-file',
        title: cleanTitle,
        author: 'Unknown',
        format: filePath.endsWith('.pdf') ? 'pdf' : 'epub',
        currentPage: 1,
        totalPages: 120,
        percentage: 1,
        lastReadAtMs: 1_700_000_300_000,
        updatedAtMs: 1_700_000_300_000,
      };
      storedBooks.set(dto.bookHash, dto);
      return dto as unknown as T;
    }
    if (cmd === 'pick_and_import_book') {
      const dto: SerializedBookMetadata = {
        bookHash: 'sha256-picked-book',
        title: 'Picked Native Book',
        author: 'Native Author',
        format: 'pdf',
        currentPage: 1,
        totalPages: 250,
        percentage: 1,
        lastReadAtMs: 1_700_000_350_000,
        updatedAtMs: 1_700_000_350_000,
      };
      storedBooks.set(dto.bookHash, dto);
      return dto as unknown as T;
    }
    if (cmd === 'get_book_file_path') {
      const hash = String(args.bookHash);
      if (hash === 'non-existent') throw new Error('Not found');
      return `/home/test/books/${hash}.pdf` as unknown as T;
    }
    if (cmd === 'save_highlight') {
      const dto = args.highlight as SerializedHighlight;
      storedDtos.set(dto.id, dto);
      return undefined as unknown as T;
    }
    if (cmd === 'load_book_highlights') {
      return Array.from(storedDtos.values()) as unknown as T;
    }
    if (cmd === 'load_all_highlights') {
      return Array.from(storedDtos.values()) as unknown as T;
    }
    if (cmd === 'delete_highlight') {
      storedDtos.delete(String(args.highlightId));
      return undefined as unknown as T;
    }
    if (cmd === 'build_term_lookup_prompt') {
      return {
        systemPrompt: `Lang:${String(args.targetLanguage)}`,
        userPrompt: String(args.selectedText),
        temperature: 0.3,
        maxTokens: 500,
      } as unknown as T;
    }
    if (cmd === 'read_book_binary') {
      return [1, 2, 3, 4] as unknown as T;
    }
    if (cmd === 'get_book_pages') {
      return [
        {
          pageNumber: Number(args.startPage),
          chapterTitle: 'Chapter 1',
          paragraphs: ['First paragraph of page'],
          cfiBase: 'epubcfi(/6/2!/4/2)',
        },
      ] as unknown as T;
    }
    if (cmd === 'sync_book_workspace') {
      return `synced:${String(args.bookHash)}` as unknown as T;
    }
    if (cmd === 'get_app_setting') {
      const key = String(args.key);
      return (storedSettings.get(key) ?? null) as unknown as T;
    }
    if (cmd === 'set_app_setting') {
      storedSettings.set(String(args.key), String(args.value));
      return undefined as unknown as T;
    }
    if (cmd === 'set_discord_presence_enabled') {
      storedSettings.set('discord_presence_enabled', String(args.enabled));
      return undefined as unknown as T;
    }
    if (cmd === 'clear_rich_presence') {
      storedSettings.set('discord_presence_cleared', 'true');
      return undefined as unknown as T;
    }
    if (cmd === 'update_library_presence') {
      storedSettings.set('discord_presence_library', String(args.totalBooks));
      return undefined as unknown as T;
    }
    if (cmd === 'update_annotations_presence') {
      storedSettings.set('discord_presence_annotations', String(args.totalAnnotations));
      return undefined as unknown as T;
    }
    if (cmd === 'update_reading_presence') {
      const payload = args.payload as Record<string, unknown>;
      storedSettings.set(
        'discord_presence_reading',
        `${String(payload.bookHash)}:${String(payload.currentPage)}/${String(payload.totalPages)}`
      );
      return undefined as unknown as T;
    }
    if (cmd === 'get_discord_presence_health') {
      return {
        ok: true,
        message: 'Connected to Discord client',
      } as unknown as T;
    }
    if (cmd === 'get_platform_info') {
      return {
        platform: 'Linux',
        configDir: '/mock/config',
        dataDir: '/mock/data',
        cacheDir: '/mock/cache',
        databasePath: '/mock/data/scholarium.db',
        supportsDiscordPresence: true,
      } as unknown as T;
    }
    throw new Error(`Unexpected command: ${cmd}`);
  }),
}));

describe('Modular Tauri IPC Adapters', () => {
  it('should manage library books via TauriLibraryService', async () => {
    const libraryService = new TauriLibraryService();

    const imported = await libraryService.importLibraryBook({
      rawBytes: new Uint8Array([1, 2, 3]),
      title: 'Direct Tauri Book',
      author: 'Tester',
      format: 'epub',
      totalPages: 100,
    });
    expect(imported.bookHash).toBe('sha256-imported-book');

    const books = await libraryService.listLibraryBooks();
    expect(books).toHaveLength(1);
    expect(books[0]?.title).toBe('Direct Tauri Book');

    const renamed = await libraryService.renameBook('sha256-imported-book', 'Renamed Tauri Book');
    expect(renamed.title).toBe('Renamed Tauri Book');

    const updatedMeta = await libraryService.updateBookMetadata('sha256-imported-book', {
      title: 'Updated Metas',
      author: 'Tauri Author',
      tags: ['TauriTag1', 'TauriTag2'],
      description: 'A great Tauri book description.',
    });
    expect(updatedMeta.title).toBe('Updated Metas');
    expect(updatedMeta.author).toBe('Tauri Author');
    expect(updatedMeta.tags).toEqual(['TauriTag1', 'TauriTag2']);
    expect(updatedMeta.description).toBe('A great Tauri book description.');

    const updatedCover = await libraryService.updateBookCover(
      'sha256-imported-book',
      'data:image/webp;base64,mockCoverData'
    );
    expect(updatedCover.coverImageUrl).toBe('data:image/webp;base64,mockCoverData');

    const authors = await libraryService.listAuthors();
    expect(authors).toContain('Tauri Author');

    const tags = await libraryService.listTags();
    expect(tags).toContain('TauriTag1');
    expect(tags).toContain('TauriTag2');

    expect(await libraryService.getStartupBook()).toBeNull();

    const opened = await libraryService.openBookFile('/path/to/my_book.pdf');
    expect(opened.title).toBe('my_book');
    expect(opened.format).toBe('pdf');

    const picked = await libraryService.pickAndImportBook();
    expect(picked).not.toBeNull();
    expect(picked?.title).toBe('Picked Native Book');

    const deleted = await libraryService.deleteBook('sha256-imported-book');
    expect(deleted).toBe(true);
    await libraryService.deleteBook('sha256-picked-book');
    const booksAfterDelete = await libraryService.listLibraryBooks();
    expect(booksAfterDelete).toHaveLength(1);
    expect(booksAfterDelete[0]?.bookHash).toBe('sha256-opened-file');
  });

  it('should open multiple files in batch via openBookFiles', async () => {
    const libraryService = new TauriLibraryService();
    const batchOpened = await libraryService.openBookFiles([
      '/path/to/book_a.epub',
      '/path/to/book_b.pdf',
    ]);
    expect(batchOpened).toHaveLength(2);
    expect(batchOpened[0]?.title).toBe('book_a');
    expect(batchOpened[0]?.format).toBe('epub');
    expect(batchOpened[1]?.title).toBe('book_b');
    expect(batchOpened[1]?.format).toBe('pdf');
  });

  it('should manage reader operations via TauriReaderService', async () => {
    const readerService = new TauriReaderService();

    const updated = await readerService.updateBookProgress('sha256-imported-book', 10, 100);
    expect(updated.percentage).toBe(10);
    expect(updated.pageOffsetRatio).toBe(0);

    const updatedWithOffset = await readerService.updateBookProgress(
      'sha256-imported-book',
      10,
      100,
      0.42
    );
    expect(updatedWithOffset.pageOffsetRatio).toBe(0.42);

    const bytes = await readerService.readBookBinary('sha256-imported-book');
    expect(bytes).toEqual(new Uint8Array([1, 2, 3, 4]));

    const path = await readerService.getBookFilePath('sha256-imported-book');
    expect(path).toBe('/home/test/books/sha256-imported-book.pdf');
    const notFoundPath = await readerService.getBookFilePath('non-existent');
    expect(notFoundPath).toBeNull();

    const pages = await readerService.getBookPages('sha256-imported-book', 1, 1);
    expect(pages).toHaveLength(1);
    expect(pages[0]?.pageNumber).toBe(1);

    const prompt = await readerService.buildTermLookupRequest({
      bookTitle: 'Direct Tauri Book',
      selectedText: 'Direct term',
      surroundingContext: 'Surrounding context',
    });
    expect(prompt.userPrompt).toBe('Direct term');
  });

  it('should manage highlights via TauriHighlightService', async () => {
    const highlightService = new TauriHighlightService();

    const highlight = new Highlight(
      'hl-direct',
      'sha256-imported-book',
      'Important direct quote',
      '#FFEB3B',
      {
        format: 'epub',
        pageNumber: 1,
        epubCfi: 'epubcfi(/6/2!/4/2/1:0)',
      },
      'User note',
      new Date('2026-03-01T10:00:00.000Z'),
      new Date('2026-03-01T10:00:00.000Z'),
      [createAssistedTextAnnotation('markdown summary', new Date('2026-03-01T10:00:00.000Z'))]
    );

    await highlightService.saveHighlight(highlight);
    const loaded = await highlightService.loadBookHighlights('sha256-imported-book');
    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.text).toBe('Important direct quote');
    expect(loaded[0]?.getAllRichAnnotations()).toHaveLength(1);

    const allLoaded = await highlightService.loadAllHighlights();
    expect(allLoaded).toHaveLength(1);
    expect(allLoaded[0]?.id).toBe('hl-direct');

    await highlightService.deleteHighlight('hl-direct');
    const afterDelete = await highlightService.loadBookHighlights('sha256-imported-book');
    expect(afterDelete).toHaveLength(0);
  });

  it('should manage settings and presence via dedicated adapters', async () => {
    const settingsService = new TauriSettingsService();
    const presenceService = new TauriPresenceService();

    expect(await settingsService.getAppSetting('theme')).toBeNull();
    await settingsService.setAppSetting('theme', 'dark');
    expect(await settingsService.getAppSetting('theme')).toBe('dark');

    const syncResult = await settingsService.syncBookWorkspace('sha256-imported-book');
    expect(syncResult).toBe('synced:sha256-imported-book');

    await presenceService.setDiscordPresenceEnabled(true);
    expect(await settingsService.getAppSetting('discord_presence_enabled')).toBe('true');

    await presenceService.clearRichPresence();
    expect(await settingsService.getAppSetting('discord_presence_cleared')).toBe('true');

    await presenceService.updateLibraryPresence(15);
    expect(await settingsService.getAppSetting('discord_presence_library')).toBe('15');

    await presenceService.updateAnnotationsPresence(42);
    expect(await settingsService.getAppSetting('discord_presence_annotations')).toBe('42');

    await presenceService.updateReadingPresence({
      bookHash: 'sha256-imported-book',
      bookTitle: 'Direct Tauri Book',
      bookAuthor: 'Tester',
      chapterTitle: 'Chapter 1',
      currentPage: 12,
      totalPages: 100,
    });
    expect(await settingsService.getAppSetting('discord_presence_reading')).toBe(
      'sha256-imported-book:12/100'
    );

    const health = await presenceService.getDiscordPresenceHealth();
    expect(health.ok).toBe(true);
    expect(health.message).toBe('Connected to Discord client');

    const platformInfo = await settingsService.getPlatformInfo();
    expect(platformInfo.platform).toBe('Linux');
    expect(platformInfo.supportsDiscordPresence).toBe(true);
  });
});

describe('MockBackend (In-Memory Modular Double)', () => {
  it('should implement all modular service operations in-memory without IPC', async () => {
    const mock = new MockBackend();
    const imported = await mock.importLibraryBook({
      rawBytes: new Uint8Array([10, 20]),
      title: 'Mocked Republic',
      author: 'Plato',
      format: 'epub',
      totalPages: 320,
    });
    expect(imported.bookHash).toContain('sha256-mocked-republic');

    const books = await mock.listLibraryBooks();
    expect(books).toHaveLength(1);

    const updated = await mock.updateBookProgress(imported.bookHash, 20, 320);
    expect(updated.currentPage).toBe(20);

    const renamedMock = await mock.renameBook(imported.bookHash, 'Renamed Mock Book');
    expect(renamedMock.title).toBe('Renamed Mock Book');

    const updatedMetaMock = await mock.updateBookMetadata(imported.bookHash, {
      title: 'Plato - Republic Extended',
      author: 'Plato of Athens',
      tags: ['Philosophy', 'Classics'],
      description: 'The definitive philosophical work.',
    });
    expect(updatedMetaMock.title).toBe('Plato - Republic Extended');
    expect(updatedMetaMock.author).toBe('Plato of Athens');
    expect(updatedMetaMock.tags).toEqual(['Philosophy', 'Classics']);
    expect(updatedMetaMock.description).toBe('The definitive philosophical work.');

    const mockAuthors = await mock.listAuthors();
    expect(mockAuthors).toContain('Plato of Athens');

    const mockTags = await mock.listTags();
    expect(mockTags).toEqual(['Classics', 'Philosophy']);

    const mockStartup = await mock.getStartupBook();
    expect(mockStartup).toBeNull();

    const mockOpened = await mock.openBookFile('/home/user/books/stoic_philosophy.epub');
    expect(mockOpened.title).toBe('stoic_philosophy');
    expect(mockOpened.format).toBe('epub');

    const pages = await mock.getBookPages(imported.bookHash, 1, 3);
    expect(pages).toHaveLength(3);
    expect(pages[0]?.pageNumber).toBe(1);
    expect(pages[2]?.pageNumber).toBe(3);

    const hl = new Highlight(
      'hl-mock-1',
      imported.bookHash,
      'Mock quote',
      '#FF0000',
      { format: 'epub', pageNumber: 1, epubCfi: 'cfi' },
      'Mock note'
    );
    await mock.saveHighlight(hl);
    const loadedHls = await mock.loadBookHighlights(imported.bookHash);
    expect(loadedHls).toHaveLength(1);
    expect(await mock.loadAllHighlights()).toHaveLength(1);

    const prompt = await mock.buildTermLookupRequest({
      bookTitle: imported.title,
      selectedText: 'term',
      surroundingContext: 'ctx',
    });
    expect(prompt.userPrompt).toContain('term');

    const syncResp = await mock.syncBookWorkspace(imported.bookHash);
    expect(syncResp).toContain('sha256-mocked-republic');
    expect(syncResp).toContain('Mock quote');

    await mock.deleteHighlight(hl.id);
    expect(await mock.loadBookHighlights(imported.bookHash)).toHaveLength(0);

    expect(await mock.getAppSetting('key1')).toBeNull();
    await mock.setAppSetting('key1', 'val1');
    expect(await mock.getAppSetting('key1')).toBe('val1');

    await mock.setDiscordPresenceEnabled(true);
    expect(await mock.getAppSetting('discord_presence_enabled')).toBe('true');

    await mock.clearRichPresence();
    expect(await mock.getAppSetting('discord_presence_cleared')).toBe('true');

    await mock.updateLibraryPresence(20);
    expect(await mock.getAppSetting('discord_presence_library')).toBe('20');

    await mock.updateAnnotationsPresence(55);
    expect(await mock.getAppSetting('discord_presence_annotations')).toBe('55');

    const mockHealth = await mock.getDiscordPresenceHealth();
    expect(mockHealth.ok).toBe(true);
    expect(mockHealth.message).toBe('Connected to Discord client');

    const mockPlatform = await mock.getPlatformInfo();
    expect(mockPlatform.supportsDiscordPresence).toBe(true);
  });

  it('correctly resolves cover image URLs according to protocol and scheme', () => {
    expect(resolveCoverUrl(undefined)).toBeUndefined();
    expect(resolveCoverUrl(null)).toBeUndefined();
    expect(resolveCoverUrl('')).toBeUndefined();
    expect(resolveCoverUrl('   ')).toBeUndefined();
    expect(resolveCoverUrl('http://example.com/cover.jpg')).toBe('http://example.com/cover.jpg');
    expect(resolveCoverUrl('https://example.com/cover.jpg')).toBe('https://example.com/cover.jpg');
    expect(resolveCoverUrl('data:image/jpeg;base64,123')).toBe('data:image/jpeg;base64,123');
    expect(resolveCoverUrl('asset://localhost/test.jpg')).toBe('asset://localhost/test.jpg');
    expect(resolveCoverUrl('/home/user/covers/book.jpg')).toBe(
      'asset://localhost//home/user/covers/book.jpg'
    );
  });
});
