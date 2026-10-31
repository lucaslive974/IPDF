import { describe, expect, it } from 'vitest';
import {
  type SerializedBookMetadata,
  type SerializedHighlight,
  TauriBackendGateway,
} from '../../../adapters/ipc/TauriBackendGateway';
import { Highlight } from '../../../core/domain/Highlight';
import {
  createAssistedTextAnnotation,
  createDrawioDiagramAnnotation,
  createTldrawBoardAnnotation,
} from '../../../core/domain/RichAnnotation';

describe('TauriBackendGateway (Rust IPC Bridge)', () => {
  it('should serialize and deserialize highlights and library books across Tauri IPC', async () => {
    const storedDtos = new Map<string, SerializedHighlight>();
    const storedBooks = new Map<string, SerializedBookMetadata>();

    const gateway = new TauriBackendGateway(
      async <T>(cmd: string, args: Record<string, unknown> = {}) => {
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
            lastReadAtMs: 1_700_000_100_000,
            updatedAtMs: 1_700_000_100_000,
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
        if (cmd === 'sync_book_workspace') {
          return `synced:${String(args.bookHash)}` as unknown as T;
        }
        throw new Error(`Unexpected command: ${cmd}`);
      }
    );

    const imported = await gateway.importLibraryBook({
      rawBytes: new Uint8Array([1, 2, 3]),
      title: 'Phaedrus',
      author: 'Plato',
      format: 'epub',
      totalPages: 100,
      coverImageUrl: 'cover://phaedrus.webp',
    });
    expect(imported.bookHash).toBe('sha256-imported-book');
    expect(imported.lastReadAt).toBeInstanceOf(Date);

    const progressed = await gateway.updateBookProgress('sha256-imported-book', 25, 100);
    expect(progressed.percentage).toBe(25);

    const libraryBooks = await gateway.listLibraryBooks();
    expect(libraryBooks).toHaveLength(1);
    expect(libraryBooks[0]?.currentPage).toBe(25);

    const binary = await gateway.readBookBinary('sha256-imported-book');
    expect(binary).toHaveLength(4);

    const original = new Highlight(
      'hl_ipc_1',
      'book_sha256',
      'Critique of Pure Reason',
      '#FFEB3B',
      { format: 'epub', pageNumber: 1, epubCfi: 'epubcfi(/6/2!/4/2)' },
      'Transcendental Aesthetic',
      new Date('2026-01-01T00:00:00.000Z'),
      new Date('2026-01-02T00:00:00.000Z'),
      [
        createAssistedTextAnnotation('**Space and Time**'),
        createTldrawBoardAnnotation('{"shapes":[]}', '<svg>board</svg>'),
        createDrawioDiagramAnnotation('<mxGraphModel/>', '<svg>diagram</svg>'),
      ]
    );

    await gateway.saveHighlight(original);
    const loaded = await gateway.loadBookHighlights('book_sha256');
    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.id).toBe('hl_ipc_1');
    expect(loaded[0]?.getAllRichAnnotations()).toHaveLength(3);

    const promptReq = await gateway.buildTermLookupRequest(
      {
        bookTitle: 'Critique of Pure Reason',
        selectedText: 'a priori',
        surroundingContext: 'Synthetic a priori judgments.',
      },
      'pt-BR'
    );
    expect(promptReq.systemPrompt).toBe('Lang:pt-BR');
    expect(promptReq.userPrompt).toBe('a priori');

    const syncReport = await gateway.syncBookWorkspace('book_sha256');
    expect(syncReport).toBe('synced:book_sha256');

    await gateway.deleteHighlight('hl_ipc_1');
    const afterDelete = await gateway.loadBookHighlights('book_sha256');
    expect(afterDelete).toHaveLength(0);
  });
});
