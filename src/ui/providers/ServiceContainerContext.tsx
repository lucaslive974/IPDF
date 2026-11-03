import {
  CachedReaderServiceDecorator,
  TauriHighlightService,
  TauriLibraryService,
  TauriPresenceService,
  TauriReaderService,
  TauriSettingsService,
} from '@adapters/ipc';
import { EpubViewerAdapter, PdfViewerAdapter } from '@adapters/viewers';
import { BookFormat } from '@domain/types';
import type {
  IDocumentViewer,
  IHighlightService,
  ILibraryService,
  IPdfViewer,
  IPresenceService,
  IReaderService,
  ISettingsService,
} from '@ports';
import { type ReactNode, createContext, useContext, useMemo } from 'react';

export interface ServiceContainer {
  readonly libraryService: ILibraryService;
  readonly highlightService: IHighlightService;
  readonly readerService: IReaderService;
  readonly presenceService: IPresenceService;
  readonly settingsService: ISettingsService;
  readonly getViewer: (format: BookFormat) => IDocumentViewer;
  readonly epubViewer: IDocumentViewer;
  readonly pdfViewer: IPdfViewer;
}

export interface ServiceContainerOverrides {
  readonly libraryService?: ILibraryService;
  readonly highlightService?: IHighlightService;
  readonly readerService?: IReaderService;
  readonly presenceService?: IPresenceService;
  readonly settingsService?: ISettingsService;
  readonly epubViewer?: IDocumentViewer;
  readonly viewer?: IDocumentViewer;
  readonly pdfViewer?: IPdfViewer;
  readonly getViewer?: (format: BookFormat) => IDocumentViewer;
  readonly enablePageCache?: boolean;
  readonly pageCacheCapacity?: number;
}

/**
 * Pure Factory to instantiate and wire Scholarium services.
 * Decouples service graph creation from React rendering and facilitates unit testing.
 */
export function createServiceContainer(
  overrides: ServiceContainerOverrides = {}
): ServiceContainer {
  const libraryService = overrides.libraryService ?? new TauriLibraryService();
  const highlightService = overrides.highlightService ?? new TauriHighlightService();
  const presenceService = overrides.presenceService ?? new TauriPresenceService();
  const settingsService = overrides.settingsService ?? new TauriSettingsService();

  const readerService = overrides.readerService
    ? overrides.enablePageCache === true &&
      !(overrides.readerService instanceof CachedReaderServiceDecorator)
      ? new CachedReaderServiceDecorator(overrides.readerService, overrides.pageCacheCapacity ?? 50)
      : overrides.readerService
    : overrides.enablePageCache !== false
      ? new CachedReaderServiceDecorator(
          new TauriReaderService(),
          overrides.pageCacheCapacity ?? 50
        )
      : new TauriReaderService();

  const epubViewer = overrides.epubViewer ?? overrides.viewer ?? new EpubViewerAdapter();
  const pdfViewer = overrides.pdfViewer ?? new PdfViewerAdapter();

  const getViewer =
    overrides.getViewer ??
    ((format: BookFormat) => {
      if (format === BookFormat.PDF) {
        return pdfViewer;
      }
      return epubViewer;
    });

  return {
    libraryService,
    highlightService,
    readerService,
    presenceService,
    settingsService,
    getViewer,
    epubViewer,
    pdfViewer,
  };
}

export const ServiceContainerContext = createContext<ServiceContainer | null>(null);

export interface ServiceContainerProviderProps extends ServiceContainerOverrides {
  readonly children?: ReactNode;
  readonly container?: ServiceContainer;
}

export function ServiceContainerProvider({
  children,
  container: injectedContainer,
  libraryService,
  highlightService,
  readerService,
  presenceService,
  settingsService,
  epubViewer,
  viewer,
  pdfViewer,
  getViewer,
  enablePageCache,
  pageCacheCapacity,
}: ServiceContainerProviderProps) {
  const container = useMemo<ServiceContainer>(() => {
    if (injectedContainer) {
      return injectedContainer;
    }
    return createServiceContainer({
      libraryService,
      highlightService,
      readerService,
      presenceService,
      settingsService,
      epubViewer,
      viewer,
      pdfViewer,
      getViewer,
      enablePageCache,
      pageCacheCapacity,
    });
  }, [
    injectedContainer,
    libraryService,
    highlightService,
    readerService,
    presenceService,
    settingsService,
    epubViewer,
    viewer,
    pdfViewer,
    getViewer,
    enablePageCache,
    pageCacheCapacity,
  ]);

  return (
    <ServiceContainerContext.Provider value={container}>
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

export function useOptionalServiceContainer(): ServiceContainer | null {
  return useContext(ServiceContainerContext);
}
