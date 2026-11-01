import { type ReactNode, createContext, useContext, useMemo } from 'react';
import {
  TauriHighlightService,
  TauriLibraryService,
  TauriPresenceService,
  TauriReaderService,
  TauriSettingsService,
} from '../../adapters/ipc';
import { EpubViewerAdapter } from '../../adapters/viewers/EpubViewerAdapter';
import type {
  IDocumentViewer,
  IHighlightService,
  ILibraryService,
  IPresenceService,
  IReaderService,
  ISettingsService,
} from '../../core/ports';

export interface ServiceContainer {
  readonly libraryService: ILibraryService;
  readonly highlightService: IHighlightService;
  readonly readerService: IReaderService;
  readonly presenceService: IPresenceService;
  readonly settingsService: ISettingsService;
  readonly epubViewer: IDocumentViewer;
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
}

export function ServiceContainerProvider({
  children,
  libraryService: injectedLibrary,
  highlightService: injectedHighlights,
  readerService: injectedReader,
  presenceService: injectedPresence,
  settingsService: injectedSettings,
  viewer,
}: ServiceContainerProviderProps) {
  const container = useMemo<ServiceContainer>(() => {
    const libraryService = injectedLibrary ?? new TauriLibraryService();
    const highlightService = injectedHighlights ?? new TauriHighlightService();
    const readerService = injectedReader ?? new TauriReaderService();
    const presenceService = injectedPresence ?? new TauriPresenceService();
    const settingsService = injectedSettings ?? new TauriSettingsService();
    const epubViewer = viewer ?? new EpubViewerAdapter();

    return {
      libraryService,
      highlightService,
      readerService,
      presenceService,
      settingsService,
      epubViewer,
    };
  }, [
    injectedLibrary,
    injectedHighlights,
    injectedReader,
    injectedPresence,
    injectedSettings,
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
