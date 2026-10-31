import { type ReactNode, createContext, useContext, useRef } from 'react';
import { AssistedRichTextStrategy } from '../../adapters/annotations/AssistedRichTextStrategy';
import {
  DrawioAnnotationStrategy,
  TldrawAnnotationStrategy,
} from '../../adapters/annotations/DiagramAnnotationStrategies';
import {
  type SerializedHighlight,
  TauriBackendGateway,
  type TauriInvokeFn,
} from '../../adapters/ipc/TauriBackendGateway';
import type { IBackendGateway } from '../../core/ports/IBackendGateway';
import { AnnotationWorkbenchService } from '../../core/services/AnnotationWorkbenchService';

export interface ServiceContainer {
  readonly backendGateway: IBackendGateway;
  readonly annotationWorkbench: AnnotationWorkbenchService;
}

function createBrowserFallbackInvoke(): TauriInvokeFn {
  const highlightsByBook = new Map<string, Map<string, SerializedHighlight>>();

  return async <T,>(cmd: string, args: Record<string, unknown> = {}): Promise<T> => {
    const tauriWindow = globalThis as unknown as {
      __TAURI_INTERNALS__?: { invoke: TauriInvokeFn };
    };
    if (tauriWindow.__TAURI_INTERNALS__?.invoke) {
      return tauriWindow.__TAURI_INTERNALS__.invoke<T>(cmd, args);
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
        userPrompt: `Book: "${String(args.bookTitle ?? '')}" | Selected: "${String(args.selectedText ?? '')}"`,
        temperature: 0.3,
        maxTokens: 500,
      } as unknown as T;
    }

    if (cmd === 'sync_book_workspace') {
      const bookHash = String(args.bookHash ?? '');
      const highlights = Array.from(highlightsByBook.get(bookHash)?.values() ?? []);
      return JSON.stringify(
        {
          version: '1.0',
          engine: 'ipdf-core (Rust LWW)',
          bookHash,
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
  const backendGateway = customGateway ?? new TauriBackendGateway(createBrowserFallbackInvoke());
  const annotationWorkbench = new AnnotationWorkbenchService(backendGateway, [
    new AssistedRichTextStrategy(),
    new TldrawAnnotationStrategy(),
    new DrawioAnnotationStrategy(),
  ]);

  return {
    backendGateway,
    annotationWorkbench,
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
