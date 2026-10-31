import { describe, expect, it, vi } from 'vitest';
import {
  type SerializedBookMetadata,
  type SerializedHighlight,
  TauriBackend,
} from '../../../adapters/ipc/TauriBackend';
import { Highlight } from '../../../core/domain/Highlight';
import {
  createAssistedTextAnnotation,
  createDrawioDiagramAnnotation,
  createTldrawBoardAnnotation,
} from '../../../core/domain/RichAnnotation';
import { MockBackend } from '../../mocks/MockBackend';

const storedDtos = new Map<string, SerializedHighlight>();
const storedBooks = new Map<string, SerializedBookMetadata>();

vi.mock('@tauri-apps/api/core', () => ({
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
      const bookHash = String(args.bookHash);
      const currentPage = Number(args.currentPage);
      const totalPages = Number(args.totalPages);
      const existing = storedBooks.get(bookHash);
      const updated: SerializedBookMetadata = {
        bookHash,
        title: existing?.title ?? 'Book',
        author: existing?.author ?? 'Author',
        format: 'epub',
        currentPage,
        totalPages,
        percentage: (currentPage / totalPages) * 100,
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
    if (cmd === 'save_highlight') {
      const dto = args.highlight as SerializedHighlight;
      storedDtos.set(dto.id, dto);
      return undefined as unknown as T;
    }
    if (cmd === 'load_book_highlights') {
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
    throw new Error(`Unexpected command: ${cmd}`);
  }),
}));

describe('TauriBackend (Direct Tauri IPC)', () => {
  it('should serialize and deserialize highlights and library books across Tauri IPC', async () => {
    const backend = new TauriBackend();

    const imported = await backend.importLibraryBook({
      rawBytes: new Uint8Array([1, 2, 3]),
      title: 'Direct Tauri Book',
      author: 'Tester',
      format: 'epub',
      totalPages: 100,
    });
    expect(imported.bookHash).toBe('sha256-imported-book');

    const books = await backend.listLibraryBooks();
    expect(books).toHaveLength(1);
    expect(books[0]?.title).toBe('Direct Tauri Book');

    const updated = await backend.updateBookProgress('sha256-imported-book', 10, 100);
    expect(updated.percentage).toBe(10);

    const renamed = await backend.renameBook('sha256-imported-book', 'Renamed Tauri Book');
    expect(renamed.title).toBe('Renamed Tauri Book');
    expect(renamed.bookHash).toBe('sha256-imported-book');

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
      [
        createAssistedTextAnnotation('markdown summary', new Date('2026-03-01T10:00:00.000Z')),
        createTldrawBoardAnnotation(
          '{"nodes":[]}',
          '<svg></svg>',
          new Date('2026-03-01T10:00:00.000Z')
        ),
        createDrawioDiagramAnnotation(
          '<mxfile></mxfile>',
          '<svg></svg>',
          new Date('2026-03-01T10:00:00.000Z')
        ),
      ]
    );

    await backend.saveHighlight(highlight);
    const loaded = await backend.loadBookHighlights('sha256-imported-book');
    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.text).toBe('Important direct quote');
    expect(loaded[0]?.getAllRichAnnotations()).toHaveLength(3);

    const prompt = await backend.buildTermLookupRequest({
      bookTitle: 'Direct Tauri Book',
      selectedText: 'Direct term',
      surroundingContext: 'Surrounding context',
    });
    expect(prompt.userPrompt).toBe('Direct term');

    const bytes = await backend.readBookBinary('sha256-imported-book');
    expect(bytes).toEqual(new Uint8Array([1, 2, 3, 4]));

    const pages = await backend.getBookPages('sha256-imported-book', 1, 1);
    expect(pages).toHaveLength(1);
    expect(pages[0]?.pageNumber).toBe(1);

    const syncResult = await backend.syncBookWorkspace('sha256-imported-book');
    expect(syncResult).toBe('synced:sha256-imported-book');

    await backend.deleteHighlight('hl-direct');
    const afterDelete = await backend.loadBookHighlights('sha256-imported-book');
    expect(afterDelete).toHaveLength(0);
  });
});

describe('MockBackend (In-Memory Test Double)', () => {
  it('should implement all BackendService operations in-memory without IPC', async () => {
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
  });
});
