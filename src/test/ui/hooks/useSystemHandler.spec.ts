import type { BookMetadata } from '@domain/BookMetadata';
import { BookFormat } from '@domain/types';
import { setupSystemEventListeners, useSystemHandler } from '@hooks/useSystemHandler';
import { ServiceContainerProvider } from '@providers/ServiceContainerContext';
import { useLibraryStore } from '@stores/useLibraryStore';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MockBackend } from '../../mocks/MockBackend';

describe('useSystemHandler / setupSystemEventListeners', () => {
  let backend: MockBackend;

  const mockBook: BookMetadata = {
    bookHash: 'startup-hash',
    title: 'Startup Book',
    author: 'Author',
    format: BookFormat.EPUB,
    currentPage: 1,
    totalPages: 100,
    percentage: 0.01,
    tags: [],
    lastReadAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    backend = new MockBackend();
    useLibraryStore.getState().reset();
  });

  describe('setupSystemEventListeners', () => {
    it('retrieves startup book on cold start and invokes onOpenBook and upsertBook', async () => {
      vi.spyOn(backend, 'getStartupBook').mockResolvedValue(mockBook);
      const onOpenBook = vi.fn();
      const upsertBook = vi.fn();

      const cleanup = setupSystemEventListeners({
        libraryService: backend,
        upsertBook,
        onOpenBook,
      });

      await Promise.resolve();
      await Promise.resolve();

      expect(upsertBook).toHaveBeenCalledWith(mockBook);
      expect(onOpenBook).toHaveBeenCalledWith(mockBook);

      cleanup();
    });

    it('handles empty startup book without invoking onOpenBook', async () => {
      vi.spyOn(backend, 'getStartupBook').mockResolvedValue(null);
      const onOpenBook = vi.fn();
      const upsertBook = vi.fn();

      const cleanup = setupSystemEventListeners({
        libraryService: backend,
        upsertBook,
        onOpenBook,
      });

      await Promise.resolve();
      await Promise.resolve();

      expect(onOpenBook).not.toHaveBeenCalled();
      expect(upsertBook).not.toHaveBeenCalled();

      cleanup();
    });

    it('handles startup book rejection gracefully', async () => {
      vi.spyOn(backend, 'getStartupBook').mockRejectedValue(new Error('Network error'));
      const onOpenBook = vi.fn();
      const upsertBook = vi.fn();

      const cleanup = setupSystemEventListeners({
        libraryService: backend,
        upsertBook,
        onOpenBook,
      });

      await Promise.resolve();
      await Promise.resolve();

      expect(onOpenBook).not.toHaveBeenCalled();
      cleanup();
    });

    it('handles window drag and drop for valid epub/pdf files', async () => {
      vi.spyOn(backend, 'openBookFile').mockResolvedValue(mockBook);
      const onOpenBook = vi.fn();
      const upsertBook = vi.fn();

      let dropHandler: ((e: DragEvent) => Promise<void>) | null = null;
      let dragOverHandler: ((e: DragEvent) => void) | null = null;

      const originalWindow = globalThis.window;
      globalThis.window = {
        addEventListener: vi.fn((event: string, handler: unknown) => {
          if (event === 'drop') dropHandler = handler as (e: DragEvent) => Promise<void>;
          if (event === 'dragover') dragOverHandler = handler as (e: DragEvent) => void;
        }),
        removeEventListener: vi.fn(),
      } as unknown as Window & typeof globalThis;

      try {
        const cleanup = setupSystemEventListeners({
          libraryService: backend,
          upsertBook,
          onOpenBook,
        });

        expect(dragOverHandler).not.toBeNull();
        expect(dropHandler).not.toBeNull();

        // 1. DragOver event calls preventDefault
        const dragOverEvent = { preventDefault: vi.fn() } as unknown as DragEvent;
        if (dragOverHandler) {
          (dragOverHandler as (e: DragEvent) => void)(dragOverEvent);
        }
        expect(dragOverEvent.preventDefault).toHaveBeenCalled();

        // 2. Ignore non-epub/pdf files
        const ignoreDropEvent = {
          preventDefault: vi.fn(),
          dataTransfer: {
            files: [{ name: 'document.txt' }],
          },
        } as unknown as DragEvent;
        if (dropHandler) {
          await (dropHandler as (e: DragEvent) => Promise<void>)(ignoreDropEvent);
        }
        expect(backend.openBookFile).not.toHaveBeenCalled();

        // 3. Drop valid epub
        const validDropEvent = {
          preventDefault: vi.fn(),
          dataTransfer: {
            files: [{ name: 'book.epub', path: '/path/to/book.epub' }],
          },
        } as unknown as DragEvent;
        if (dropHandler) {
          await (dropHandler as (e: DragEvent) => Promise<void>)(validDropEvent);
        }
        expect(backend.openBookFile).toHaveBeenCalledWith('/path/to/book.epub');
        expect(upsertBook).toHaveBeenCalledWith(mockBook);
        expect(onOpenBook).toHaveBeenCalledWith(mockBook);

        cleanup();
      } finally {
        globalThis.window = originalWindow;
      }
    });
  });

  describe('useSystemHandler hook component integration', () => {
    it('mounts without error inside ServiceContainerProvider', () => {
      function Consumer() {
        useSystemHandler({ onOpenBook: vi.fn() });
        return null;
      }

      expect(() => {
        renderToStaticMarkup(
          React.createElement(
            ServiceContainerProvider,
            { libraryService: backend },
            React.createElement(Consumer)
          )
        );
      }).not.toThrow();
    });
  });
});
