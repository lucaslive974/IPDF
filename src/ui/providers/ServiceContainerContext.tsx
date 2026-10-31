import { type ReactNode, createContext, useContext, useMemo } from 'react';
import { AssistedRichTextStrategy } from '../../adapters/annotations/AssistedRichTextStrategy';
import {
  DrawioAnnotationStrategy,
  TldrawAnnotationStrategy,
} from '../../adapters/annotations/DiagramAnnotationStrategies';
import { TauriBackendGateway } from '../../adapters/ipc/TauriBackendGateway';
import { EpubViewerAdapter } from '../../adapters/viewers/EpubViewerAdapter';
import type { IBackendGateway } from '../../core/ports/IBackendGateway';
import type { IDocumentViewer } from '../../core/ports/IDocumentViewer';
import { AnnotationWorkbenchService } from '../../core/services/AnnotationWorkbenchService';

export interface ServiceContainer {
  readonly backendGateway: IBackendGateway;
  readonly annotationWorkbench: AnnotationWorkbenchService;
  readonly epubViewer: IDocumentViewer;
}

export const ServiceContainerContext = createContext<ServiceContainer | null>(null);

export interface ServiceContainerProviderProps {
  readonly children: ReactNode;
  readonly gateway?: IBackendGateway;
  readonly viewer?: IDocumentViewer;
}

export function ServiceContainerProvider({
  children,
  gateway,
  viewer,
}: ServiceContainerProviderProps) {
  const container = useMemo<ServiceContainer>(() => {
    const backendGateway = gateway ?? new TauriBackendGateway();
    const annotationWorkbench = new AnnotationWorkbenchService(backendGateway, [
      new AssistedRichTextStrategy(),
      new TldrawAnnotationStrategy(),
      new DrawioAnnotationStrategy(),
    ]);
    const epubViewer = viewer ?? new EpubViewerAdapter();
    return {
      backendGateway,
      annotationWorkbench,
      epubViewer,
    };
  }, [gateway, viewer]);

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
