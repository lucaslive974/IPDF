import { type ReactNode, createContext, useContext, useMemo } from 'react';
import { AssistedRichTextStrategy } from '../../adapters/annotations/AssistedRichTextStrategy';
import {
  DrawioAnnotationStrategy,
  TldrawAnnotationStrategy,
} from '../../adapters/annotations/DiagramAnnotationStrategies';
import { TauriBackend } from '../../adapters/ipc/TauriBackend';
import { EpubViewerAdapter } from '../../adapters/viewers/EpubViewerAdapter';
import type { BackendService } from '../../core/ports/BackendService';
import type { IDocumentViewer } from '../../core/ports/IDocumentViewer';
import { AnnotationWorkbenchService } from '../../core/services/AnnotationWorkbenchService';

export interface ServiceContainer {
  readonly services: BackendService;
  readonly annotationWorkbench: AnnotationWorkbenchService;
  readonly epubViewer: IDocumentViewer;
}

export const ServiceContainerContext = createContext<ServiceContainer | null>(null);

export interface ServiceContainerProviderProps {
  readonly children: ReactNode;
  readonly services?: BackendService;
  readonly viewer?: IDocumentViewer;
}

export function ServiceContainerProvider({
  children,
  services: injectedServices,
  viewer,
}: ServiceContainerProviderProps) {
  const container = useMemo<ServiceContainer>(() => {
    const services = injectedServices ?? new TauriBackend();
    const annotationWorkbench = new AnnotationWorkbenchService(services, [
      new AssistedRichTextStrategy(),
      new TldrawAnnotationStrategy(),
      new DrawioAnnotationStrategy(),
    ]);
    const epubViewer = viewer ?? new EpubViewerAdapter();
    return {
      services,
      annotationWorkbench,
      epubViewer,
    };
  }, [injectedServices, viewer]);

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
