import {
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
  readonly pdfViewer: IDocumentViewer;
}

export const ServiceContainerContext = createContext<ServiceContainer | null>(null);

export interface ServiceContainerProviderProps {
  readonly children: ReactNode;
  readonly libraryService?: ILibraryService;
  readonly highlightService?: IHighlightService;
  readonly readerService?: IReaderService;
  readonly presenceService?: IPresenceService;
  readonly settingsService?: ISettingsService;
  readonly viewer?: IDocumentViewer;
  readonly pdfViewer?: IDocumentViewer;
  readonly getViewer?: (format: BookFormat) => IDocumentViewer;
}

export function ServiceContainerProvider({
  children,
  libraryService: injectedLibrary,
  highlightService: injectedHighlights,
  readerService: injectedReader,
  presenceService: injectedPresence,
  settingsService: injectedSettings,
  viewer,
  pdfViewer: injectedPdfViewer,
  getViewer: injectedGetViewer,
}: ServiceContainerProviderProps) {
  const container = useMemo<ServiceContainer>(() => {
    const libraryService = injectedLibrary ?? new TauriLibraryService();
    const highlightService = injectedHighlights ?? new TauriHighlightService();
    const readerService = injectedReader ?? new TauriReaderService();
    const presenceService = injectedPresence ?? new TauriPresenceService();
    const settingsService = injectedSettings ?? new TauriSettingsService();
    const epubViewer = viewer ?? new EpubViewerAdapter();
    const pdfViewer = injectedPdfViewer ?? new PdfViewerAdapter();
    const getViewer =
      injectedGetViewer ??
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
  }, [
    injectedLibrary,
    injectedHighlights,
    injectedReader,
    injectedPresence,
    injectedSettings,
    injectedPdfViewer,
    injectedGetViewer,
    viewer,
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
