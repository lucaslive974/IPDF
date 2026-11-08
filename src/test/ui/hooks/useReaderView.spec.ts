import { isImmersiveBackgroundClick, useReaderView } from '@hooks/useReaderView';
import { NavigationProvider } from '@providers/NavigationContext';
import { ServiceContainerProvider } from '@providers/ServiceContainerContext';
import { useReaderStore } from '@stores/useReaderStore';
import { useReaderUIStore } from '@stores/useReaderUIStore';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MockBackend } from '../../mocks/MockBackend';

describe('useReaderView', () => {
  beforeEach(() => {
    useReaderStore.getState().reset();
    useReaderUIStore.getState().closeAllOverlays();
  });

  describe('isImmersiveBackgroundClick', () => {
    it('returns false if overlays are open', () => {
      expect(isImmersiveBackgroundClick(null, false, true)).toBe(false);
    });

    it('returns false if user has active text selection', () => {
      expect(isImmersiveBackgroundClick(null, true, false)).toBe(false);
    });

    it('returns true for neutral clicks with no selection and no overlays', () => {
      expect(isImmersiveBackgroundClick(null, false, false)).toBe(true);
    });

    it('returns false when target is an interactive button or input', () => {
      const mockButtonTarget = {
        closest: (selector: string) => (selector.includes('button') ? {} : null),
      } as HTMLElement;

      expect(isImmersiveBackgroundClick(mockButtonTarget, false, false)).toBe(false);
    });
  });

  describe('handleCloseReader', () => {
    it('persists progress, closes overlays, and resets reader store on close', async () => {
      const backend = new MockBackend();
      const updateProgressSpy = vi.spyOn(backend, 'updateBookProgress');

      useReaderStore.getState().setDocument({
        bookHash: 'book-hash-close',
        bookTitle: 'Test Title',
        bookAuthor: 'Test Author',
        chapterTitle: 'Ch 1',
        sampleParagraph: 'Paragraph',
      });
      useReaderStore.getState().setCurrentPage(7);
      useReaderStore.getState().setTotalPages(20);
      useReaderStore.getState().setPageOffsetRatio(0.4);
      useReaderStore.getState().setStreamReady(true);

      let capturedClose: (() => Promise<void>) | null = null;

      function TestConsumer() {
        const { handleCloseReader } = useReaderView();
        capturedClose = handleCloseReader;
        return null;
      }

      renderToStaticMarkup(
        React.createElement(
          ServiceContainerProvider,
          {
            readerService: backend,
            libraryService: backend,
            highlightService: backend,
            presenceService: backend,
          },
          React.createElement(
            NavigationProvider,
            { initialView: 'reader' },
            React.createElement(TestConsumer)
          )
        )
      );

      expect(capturedClose).not.toBeNull();
      if (capturedClose) {
        await (capturedClose as () => Promise<void>)();
      }

      expect(updateProgressSpy).toHaveBeenCalledWith('book-hash-close', 7, 20, 0.4);
      expect(useReaderStore.getState().document.bookHash).toBe('');
      expect(useReaderStore.getState().isStreamReady).toBe(false);
      expect(useReaderStore.getState().loadedPages.byPage.size).toBe(0);
    });
  });
});
