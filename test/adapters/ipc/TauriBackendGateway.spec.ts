import { describe, expect, it } from 'vitest';
import {
  type SerializedHighlight,
  TauriBackendGateway,
} from '../../../src/adapters/ipc/TauriBackendGateway';
import { Highlight } from '../../../src/core/domain/Highlight';
import {
  AssistedTextAnnotation,
  DrawioDiagramAnnotation,
  TldrawBoardAnnotation,
} from '../../../src/core/domain/RichAnnotation';

describe('TauriBackendGateway (Rust IPC Bridge)', () => {
  it('should serialize and deserialize highlights with all rich annotation types across Tauri IPC', async () => {
    const storedDtos = new Map<string, SerializedHighlight>();

    const gateway = new TauriBackendGateway(
      async <T>(cmd: string, args: Record<string, unknown> = {}) => {
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
        if (cmd === 'sync_book_workspace') {
          return `synced:${String(args.bookHash)}` as unknown as T;
        }
        throw new Error(`Unexpected command: ${cmd}`);
      }
    );

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
        new AssistedTextAnnotation('**Space and Time**'),
        new TldrawBoardAnnotation('{"shapes":[]}', '<svg>board</svg>'),
        new DrawioDiagramAnnotation('<mxGraphModel/>', '<svg>diagram</svg>'),
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
