import { CachedReaderServiceDecorator, TauriReaderService } from '@adapters/ipc';
import { EpubViewerAdapter } from '@adapters/viewers/EpubViewerAdapter';
import { PdfViewerAdapter } from '@adapters/viewers/PdfViewerAdapter';
import { BookFormat } from '@domain/types';
import type { ILibraryService, IReaderService } from '@ports';
import {
  type ServiceContainer,
  ServiceContainerProvider,
  createServiceContainer,
  useOptionalServiceContainer,
  useServiceContainer,
} from '@providers/ServiceContainerContext';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

describe('ServiceContainer Factory & Context (Static Composition)', () => {
  it('creates default service container with all services, cached reader, and viewers wired', () => {
    const container = createServiceContainer();

    expect(container.libraryService).toBeDefined();
    expect(container.highlightService).toBeDefined();
    expect(container.readerService).toBeInstanceOf(CachedReaderServiceDecorator);
    expect(container.presenceService).toBeDefined();
    expect(container.settingsService).toBeDefined();

    expect(container.epubViewer).toBeInstanceOf(EpubViewerAdapter);
    expect(container.pdfViewer).toBeInstanceOf(PdfViewerAdapter);

    expect(container.getViewer(BookFormat.PDF)).toBe(container.pdfViewer);
    expect(container.getViewer(BookFormat.EPUB)).toBe(container.epubViewer);
  });

  it('supports disabling page cache when enablePageCache is false', () => {
    const container = createServiceContainer({ enablePageCache: false });
    expect(container.readerService).toBeInstanceOf(TauriReaderService);
    expect(container.readerService).not.toBeInstanceOf(CachedReaderServiceDecorator);
  });

  it('respects injected service overrides', () => {
    const mockLibrary = { getBooks: vi.fn() } as unknown as ILibraryService;
    const mockReader = { getBookPages: vi.fn() } as unknown as IReaderService;

    const container = createServiceContainer({
      libraryService: mockLibrary,
      readerService: mockReader,
    });

    expect(container.libraryService).toBe(mockLibrary);
    expect(container.readerService).toBe(mockReader);
  });

  it('supports custom getViewer routing override', () => {
    const customViewer = new EpubViewerAdapter();
    const customGetViewer = vi.fn(() => customViewer);

    const container = createServiceContainer({
      getViewer: customGetViewer,
    });

    expect(container.getViewer(BookFormat.PDF)).toBe(customViewer);
    expect(customGetViewer).toHaveBeenCalledWith(BookFormat.PDF);
  });

  it('throws helpful error when useServiceContainer is called outside of Provider', () => {
    function Consumer() {
      useServiceContainer();
      return null;
    }

    expect(() => {
      renderToStaticMarkup(React.createElement(Consumer));
    }).toThrow('useServiceContainer must be used within a ServiceContainerProvider');
  });

  it('allows injecting a pre-built container directly into ServiceContainerProvider', () => {
    const prebuilt = createServiceContainer();
    let captured: ServiceContainer | null = null;

    function Consumer() {
      captured = useServiceContainer();
      return null;
    }

    renderToStaticMarkup(
      React.createElement(
        ServiceContainerProvider,
        { container: prebuilt },
        React.createElement(Consumer)
      )
    );

    expect(captured).toBe(prebuilt);
  });

  it('allows configuring ServiceContainerProvider with individual override props', () => {
    const mockLibrary = { getBooks: vi.fn() } as unknown as ILibraryService;
    let captured: ServiceContainer | null = null;

    function Consumer() {
      captured = useServiceContainer();
      return null;
    }

    renderToStaticMarkup(
      React.createElement(
        ServiceContainerProvider,
        { libraryService: mockLibrary },
        React.createElement(Consumer)
      )
    );

    expect((captured as ServiceContainer | null)?.libraryService).toBe(mockLibrary);
  });

  it('returns null when useOptionalServiceContainer is used outside Provider', () => {
    let result: ServiceContainer | null = 'sentinel' as unknown as ServiceContainer;

    function Consumer() {
      result = useOptionalServiceContainer();
      return null;
    }

    renderToStaticMarkup(React.createElement(Consumer));
    expect(result).toBeNull();
  });
});
