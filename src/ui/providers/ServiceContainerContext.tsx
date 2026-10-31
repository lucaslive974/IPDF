import { type ReactNode, createContext, useContext, useRef } from 'react';
import { InMemoryBookRepository } from '../../../test/fakes/InMemoryBookRepository';
import { InMemoryFileStorage } from '../../../test/fakes/InMemoryFileStorage';
import { InMemoryHighlightRepository } from '../../../test/fakes/InMemoryHighlightRepository';
import { InMemoryRemoteStorageProvider } from '../../../test/fakes/InMemoryRemoteStorageProvider';
import { JsonExportStrategy } from '../../../test/fakes/JsonExportStrategy';
import { AssistedRichTextStrategy } from '../../adapters/annotations/AssistedRichTextStrategy';
import {
  DrawioAnnotationStrategy,
  TldrawAnnotationStrategy,
} from '../../adapters/annotations/DiagramAnnotationStrategies';
import { CloudlessSyncEngine } from '../../core/services/CloudlessSyncEngine';
import { DataPortabilityService } from '../../core/services/DataPortabilityService';
import { HighlightManager } from '../../core/services/HighlightManager';
import { PromptBuilder } from '../../core/services/PromptBuilder';

export interface ServiceContainer {
  readonly highlightManager: HighlightManager;
  readonly syncEngine: CloudlessSyncEngine;
  readonly portabilityService: DataPortabilityService;
  readonly jsonStrategy: JsonExportStrategy;
  readonly promptBuilder: PromptBuilder;
}

export function createDefaultServiceContainer(): ServiceContainer {
  const bookRepo = new InMemoryBookRepository();
  const highlightRepo = new InMemoryHighlightRepository();
  const fileStorage = new InMemoryFileStorage();
  const remoteStorage = new InMemoryRemoteStorageProvider();
  const jsonStrategy = new JsonExportStrategy();

  const highlightManager = new HighlightManager(highlightRepo, [
    new AssistedRichTextStrategy(),
    new TldrawAnnotationStrategy(),
    new DrawioAnnotationStrategy(),
  ]);

  const portabilityService = new DataPortabilityService(bookRepo, highlightRepo, fileStorage);
  const syncEngine = new CloudlessSyncEngine(remoteStorage, portabilityService, jsonStrategy);

  return {
    highlightManager,
    syncEngine,
    portabilityService,
    jsonStrategy,
    promptBuilder: new PromptBuilder(),
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
