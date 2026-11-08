import { useReaderStreamVirtualization } from '@hooks/useReaderStreamVirtualization';
import { useReaderStore } from '@stores/useReaderStore';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('useReaderStreamVirtualization hook', () => {
  beforeEach(() => {
    useReaderStore.getState().reset();
  });

  const mockPagination = {
    loadMorePages: vi.fn(),
    onPageVisible: vi.fn(),
    goToPage: vi.fn(),
    navigatePage: vi.fn(),
    restoreInitialScroll: vi.fn(),
    isLocked: vi.fn(() => false),
    lockScroll: vi.fn(),
    unlockScroll: vi.fn(),
  };

  it('calculates virtual spacers and sorts loaded pages in ascending order', () => {
    const pages = [
      { pageNumber: 15, chapterTitle: 'Ch 15', paragraphs: ['P15'], cfiBase: '/6/30!' },
      { pageNumber: 10, chapterTitle: 'Ch 10', paragraphs: ['P10'], cfiBase: '/6/20!' },
      { pageNumber: 12, chapterTitle: 'Ch 12', paragraphs: ['P12'], cfiBase: '/6/24!' },
    ];

    useReaderStore.getState().setTotalPages(50);
    useReaderStore.getState().setLoadedPages(pages);

    let captured: ReturnType<typeof useReaderStreamVirtualization> | null = null;

    function TestComponent() {
      const contentAreaRef = React.useRef<HTMLDivElement>(null);
      captured = useReaderStreamVirtualization({
        pagination: mockPagination,
        contentAreaRef,
        isPdf: false,
        loadedPages: pages,
        totalPages: 50,
      });
      return null;
    }

    renderToStaticMarkup(React.createElement(TestComponent));

    expect(captured).not.toBeNull();
    const result = captured as unknown as ReturnType<typeof useReaderStreamVirtualization>;

    // Sorted ascending: 10, 12, 15
    expect(result.sortedPages.map((p) => p.pageNumber)).toEqual([10, 12, 15]);

    // EPUB default height is 900
    // topSpacer: (10 - 1) * 900 = 8100
    expect(result.topSpacerHeight).toBe(8100);
    // bottomSpacer: (50 - 15) * 900 = 31500
    expect(result.bottomSpacerHeight).toBe(31500);

    // Refs are initialized
    expect(result.topSentinelRef).toBeDefined();
    expect(result.bottomSentinelRef).toBeDefined();
  });

  it('calculates default page height based on PDF aspect ratio when isPdf is true', () => {
    const pages = [
      { pageNumber: 1, chapterTitle: 'P1', paragraphs: ['P1'], cfiBase: '' },
      { pageNumber: 5, chapterTitle: 'P5', paragraphs: ['P5'], cfiBase: '' },
    ];

    useReaderStore.getState().setTotalPages(20);
    useReaderStore.getState().setLoadedPages(pages);

    let captured: ReturnType<typeof useReaderStreamVirtualization> | null = null;

    function TestPdfComponent() {
      const mockElement = { clientWidth: 1000 } as HTMLElement;
      const contentAreaRef = { current: mockElement };
      captured = useReaderStreamVirtualization({
        pagination: mockPagination,
        contentAreaRef,
        isPdf: true,
        loadedPages: pages,
        totalPages: 20,
      });
      return null;
    }

    renderToStaticMarkup(React.createElement(TestPdfComponent));

    expect(captured).not.toBeNull();
    const result = captured as unknown as ReturnType<typeof useReaderStreamVirtualization>;

    // Expected PDF height: Math.round(1000 * Math.SQRT2) = 1414
    // Page 1 is first -> topSpacer is 0
    expect(result.topSpacerHeight).toBe(0);
    // bottomSpacer: (20 - 5) * 1414 = 21210
    expect(result.bottomSpacerHeight).toBe(15 * 1414);
  });
});
