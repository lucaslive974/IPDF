import { invoke } from '@tauri-apps/api/core';
import { type ReactNode, createContext, useContext, useRef } from 'react';
import { AssistedRichTextStrategy } from '../../adapters/annotations/AssistedRichTextStrategy';
import {
  DrawioAnnotationStrategy,
  TldrawAnnotationStrategy,
} from '../../adapters/annotations/DiagramAnnotationStrategies';
import {
  type SerializedBookMetadata,
  type SerializedHighlight,
  TauriBackendGateway,
  type TauriInvokeFn,
} from '../../adapters/ipc/TauriBackendGateway';
import { EpubViewerAdapter } from '../../adapters/viewers/EpubViewerAdapter';
import type { IBackendGateway } from '../../core/ports/IBackendGateway';
import type { IDocumentViewer } from '../../core/ports/IDocumentViewer';
import { AnnotationWorkbenchService } from '../../core/services/AnnotationWorkbenchService';

export interface ServiceContainer {
  readonly backendGateway: IBackendGateway;
  readonly annotationWorkbench: AnnotationWorkbenchService;
  readonly epubViewer: IDocumentViewer;
}

export function createHybridInvoke(): TauriInvokeFn {
  const highlightsByBook = new Map<string, Map<string, SerializedHighlight>>();
  const booksByHash = new Map<string, SerializedBookMetadata>([
    [
      'sha256-plato-republic-book-vii',
      {
        bookHash: 'sha256-plato-republic-book-vii',
        title: 'The Republic',
        author: 'Plato',
        format: 'epub',
        currentPage: 1,
        totalPages: 320,
        percentage: 1,
        lastReadAtMs: Date.now(),
        updatedAtMs: Date.now(),
      },
    ],
  ]);

  return async <T,>(cmd: string, args: Record<string, unknown> = {}): Promise<T> => {
    const hasTauriInternals =
      typeof globalThis !== 'undefined' &&
      '__TAURI_INTERNALS__' in (globalThis as Record<string, unknown>);

    if (hasTauriInternals) {
      try {
        return await invoke<T>(cmd, args);
      } catch {
        // Fallback to in-memory handler if native command is unavailable
      }
    }

    if (cmd === 'list_library_books') {
      return Array.from(booksByHash.values()).sort(
        (a, b) => b.lastReadAtMs - a.lastReadAtMs
      ) as unknown as T;
    }

    if (cmd === 'import_library_book') {
      const title = String(args.title ?? 'Untitled');
      const bookHash = `sha256-${title.toLowerCase().replace(/\s+/g, '-')}`;
      const totalPages = Math.max(1, Number(args.totalPages ?? 100));
      const nowMs = Date.now();
      const dto: SerializedBookMetadata = {
        bookHash,
        title,
        author: String(args.author ?? 'Unknown'),
        format: 'epub',
        currentPage: 1,
        totalPages,
        percentage: Math.round((1 / totalPages) * 100),
        coverImageUrl: args.coverImageUrl ? String(args.coverImageUrl) : undefined,
        lastReadAtMs: nowMs,
        updatedAtMs: nowMs,
      };
      booksByHash.set(bookHash, dto);
      return dto as unknown as T;
    }

    if (cmd === 'update_book_progress') {
      const bookHash = String(args.bookHash ?? '');
      const currentPage = Math.max(1, Number(args.currentPage ?? 1));
      const totalPages = Math.max(1, Number(args.totalPages ?? 1));
      const existing = booksByHash.get(bookHash);
      const nowMs = Date.now();
      const updated: SerializedBookMetadata = {
        bookHash,
        title: existing?.title ?? 'The Republic',
        author: existing?.author ?? 'Plato',
        format: existing?.format ?? 'epub',
        currentPage,
        totalPages,
        percentage: Math.round((currentPage / totalPages) * 100),
        coverImageUrl: existing?.coverImageUrl,
        lastReadAtMs: nowMs,
        updatedAtMs: nowMs,
      };
      booksByHash.set(bookHash, updated);
      return updated as unknown as T;
    }

    if (cmd === 'load_book_highlights') {
      const bookHash = String(args.bookHash ?? '');
      const map = highlightsByBook.get(bookHash);
      return (map ? Array.from(map.values()) : []) as unknown as T;
    }

    if (cmd === 'save_highlight') {
      const hl = args.highlight as SerializedHighlight;
      let map = highlightsByBook.get(hl.bookHash);
      if (!map) {
        map = new Map<string, SerializedHighlight>();
        highlightsByBook.set(hl.bookHash, map);
      }
      map.set(hl.id, hl);
      return undefined as unknown as T;
    }

    if (cmd === 'delete_highlight') {
      const highlightId = String(args.highlightId ?? '');
      for (const map of highlightsByBook.values()) {
        map.delete(highlightId);
      }
      return undefined as unknown as T;
    }

    if (cmd === 'build_term_lookup_prompt') {
      return {
        systemPrompt: `Rust ipdf-core PromptBuilder (${String(args.targetLanguage ?? 'en')})`,
        userPrompt: [
          `Book Title: ${String(args.bookTitle ?? '')}`,
          `Author: ${String(args.bookAuthor ?? 'Unknown')}`,
          args.chapterTitle ? `Chapter: ${String(args.chapterTitle)}` : null,
          `Surrounding Paragraph: "${String(args.surroundingContext ?? '')}"`,
          `Selected Text: "${String(args.selectedText ?? '')}"`,
          `Task: Define the selected term "${String(args.selectedText ?? '')}" in ${String(args.targetLanguage ?? 'en')} within this specific work's context.`,
        ]
          .filter(Boolean)
          .join('\n'),
        temperature: 0.2,
        maxTokens: 500,
      } as unknown as T;
    }

    if (cmd === 'sync_book_workspace') {
      const bookHash = String(args.bookHash ?? '');
      const highlights = Array.from(highlightsByBook.get(bookHash)?.values() ?? []);
      return JSON.stringify(
        {
          schemaVersion: 1,
          engine: 'ipdf-core (In-Memory LWW Sync)',
          bookHash,
          highlightsCount: highlights.length,
          highlights,
        },
        null,
        2
      ) as unknown as T;
    }

    throw new Error(`Unsupported IPC command: ${cmd}`);
  };
}

export function createDefaultServiceContainer(customGateway?: IBackendGateway): ServiceContainer {
  const backendGateway = customGateway ?? new TauriBackendGateway(createHybridInvoke());
  const annotationWorkbench = new AnnotationWorkbenchService(backendGateway, [
    new AssistedRichTextStrategy(),
    new TldrawAnnotationStrategy(),
    new DrawioAnnotationStrategy(),
  ]);
  const epubViewer = new EpubViewerAdapter();

  return {
    backendGateway,
    annotationWorkbench,
    epubViewer,
  };
}

const ServiceContainerContext = createContext<ServiceContainer | null>(null);

export interface ServiceContainerProviderProps {
  readonly container?: ServiceContainer;
  readonly children: ReactNode;
}

export function ServiceContainerProvider({ container, children }: ServiceContainerProviderProps) {
  const containerRef = useRef<ServiceContainer | null>(container ?? null);
  if (!containerRef.current) {
    containerRef.current = createDefaultServiceContainer();
  }

  return (
    <ServiceContainerContext.Provider value={containerRef.current}>
      {children}
    </ServiceContainerContext.Provider>
  );
}

export function useServiceContainer(): ServiceContainer {
  const context = useContext(ServiceContainerContext);
  if (!context) {
    throw new Error('useServiceContainer must be used within a ServiceContainerProvider');
  }
  return context;
}
