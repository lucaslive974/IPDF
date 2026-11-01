import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { BookMetadata } from '../../core/domain/BookMetadata';
import type { IDocumentViewer } from '../../core/ports/IDocumentViewer';
import type { DocumentPage, IReaderService } from '../../core/ports/IReaderService';
import { isValidAuthor } from '../components/library/BookCover';
import { useNavigation } from '../hooks/useNavigation';
import { useServiceContainer } from '../providers/ServiceContainerContext';
import {
  DEFAULT_BOOK_HASH,
  DEFAULT_DOCUMENT,
  type StudyDocumentDescriptor,
  useReaderStore,
} from '../stores/useReaderStore';

export interface UseReaderPaginationOptions {
  readonly bookOverride?: BookMetadata | null;
  readonly onBookLoaded?: (bookHash: string) => Promise<void> | void;
  readonly onPageChanged?: (pageNumber: number) => Promise<void> | void;
}

export interface ReaderPaginationState {
  readonly document: StudyDocumentDescriptor;
  readonly currentPage: number;
  readonly totalPages: number;
  readonly chapterTitle: string;
  readonly paragraphs: readonly string[];
  readonly loadedPages: readonly DocumentPage[];

  navigatePage(delta: number): Promise<void>;
  goToPage(targetPage: number): Promise<void>;
  loadMorePages(direction: 'next' | 'prev'): Promise<void>;
  onPageVisible(pageNumber: number): void;
}

export interface ReaderPaginationDependencies {
  readonly readerService: IReaderService;
  readonly epubViewer: IDocumentViewer;
  readonly store?: typeof useReaderStore;
}

export interface ReaderPaginationController {
  bootstrapBook(
    book?: BookMetadata | null,
    onBookLoaded?: (hash: string) => Promise<void> | void
  ): Promise<StudyDocumentDescriptor>;
  loadMorePages(direction: 'next' | 'prev'): Promise<void>;
  onPageVisible(pageNumber: number): void;
  goToPage(
    targetPage: number,
    onPageChanged?: (pageNumber: number) => Promise<void> | void
  ): Promise<void>;
  navigatePage(
    delta: number,
    onPageChanged?: (pageNumber: number) => Promise<void> | void
  ): Promise<void>;
}

export function createReaderPaginationController(
  deps: ReaderPaginationDependencies
): ReaderPaginationController {
  const store = deps.store ?? useReaderStore;
  let isLoadingMore = false;

  return {
    async bootstrapBook(book, onBookLoaded) {
      const doc: StudyDocumentDescriptor = book
        ? {
            bookHash: book.bookHash,
            bookTitle: book.title,
            bookAuthor: book.author,
            chapterTitle: `Chapter ${book.currentPage} &mdash; Reading Session`,
            sampleParagraph:
              book.bookHash === DEFAULT_BOOK_HASH
                ? DEFAULT_DOCUMENT.sampleParagraph
                : isValidAuthor(book.author)
                  ? `Reading "${book.title}" by ${book.author}. Select any passage in the text to create persistent highlights, add margin notes, or consult AI explanations.`
                  : `Reading "${book.title}". Select any passage in the text to create persistent highlights, add margin notes, or consult AI explanations.`,
            coverImageUrl: book.coverImageUrl,
          }
        : DEFAULT_DOCUMENT;

      store.getState().setDocument(doc);
      const initialPage = book?.currentPage || 1;
      store.getState().setCurrentPage(initialPage);
      if (book?.totalPages) {
        store.getState().setTotalPages(book.totalPages);
      }

      try {
        const pages = await deps.readerService.getBookPages(doc.bookHash, initialPage, 5);
        if (pages.length > 0) {
          store.getState().setLoadedPages(pages);
          const first = pages[0];
          if (first?.chapterTitle) {
            store.getState().setChapterTitle(first.chapterTitle);
          }
          deps.epubViewer.setPages(pages);
          if (book?.totalPages) {
            store.getState().setTotalPages(book.totalPages);
          }
        } else {
          const rawBytes = await deps.readerService.readBookBinary(doc.bookHash);
          if (rawBytes.length > 0) {
            const container =
              typeof globalThis !== 'undefined' && globalThis.document?.createElement
                ? globalThis.document.createElement('div')
                : ({ innerHTML: '' } as unknown as HTMLElement);
            await deps.epubViewer.render(container, rawBytes.buffer as ArrayBuffer);
            const chunk = deps.epubViewer.getPagesChunk(initialPage, 5);
            if (chunk.length > 0) {
              store.getState().setLoadedPages(chunk);
            }
            const info = deps.epubViewer.getCurrentPage();
            if (info.totalPages > 0) {
              store.getState().setTotalPages(info.totalPages);
            }
          }
        }
      } catch (err) {
        console.warn('Failed to load book pages in reader:', err);
      }

      if (onBookLoaded) {
        await onBookLoaded(doc.bookHash);
      }

      return doc;
    },

    async loadMorePages(direction: 'next' | 'prev') {
      if (isLoadingMore) return;
      isLoadingMore = true;

      const state = store.getState();
      try {
        if (direction === 'next') {
          const lastPageNum =
            state.loadedPages.length > 0
              ? Math.max(...state.loadedPages.map((p) => p.pageNumber))
              : 0;
          if (lastPageNum >= state.totalPages) return;
          const nextPages = await deps.readerService.getBookPages(
            state.document.bookHash,
            lastPageNum + 1,
            5
          );
          if (nextPages.length === 0) return;
          store.getState().upsertPages(nextPages);
        } else {
          const firstPageNum =
            state.loadedPages.length > 0
              ? Math.min(...state.loadedPages.map((p) => p.pageNumber))
              : 1;
          if (firstPageNum <= 1) return;
          const prevStart = Math.max(1, firstPageNum - 5);
          const prevCount = firstPageNum - prevStart;
          const prevPages = await deps.readerService.getBookPages(
            state.document.bookHash,
            prevStart,
            prevCount
          );
          if (prevPages.length === 0) return;
          store.getState().upsertPages(prevPages);
        }
      } catch (err) {
        console.warn('Failed to load more pages:', err);
      } finally {
        isLoadingMore = false;
      }
    },

    onPageVisible(pageNumber: number) {
      const state = store.getState();
      if (pageNumber === state.currentPage) return;
      store.getState().setCurrentPage(pageNumber);
      const visible = state.loadedPages.find((p) => p.pageNumber === pageNumber);
      if (visible?.chapterTitle) {
        store.getState().setChapterTitle(visible.chapterTitle);
      }
      void deps.readerService.updateBookProgress(
        state.document.bookHash,
        pageNumber,
        state.totalPages
      );
    },

    async goToPage(targetPage: number, onPageChanged) {
      const state = store.getState();
      const next = Math.max(1, Math.min(state.totalPages, targetPage));
      store.getState().setCurrentPage(next);
      const exists = state.loadedPages.some((p) => p.pageNumber === next);
      if (!exists) {
        const start = Math.max(1, next - 2);
        const count = Math.min(5, state.totalPages - start + 1);
        const pages = await deps.readerService.getBookPages(state.document.bookHash, start, count);
        if (pages.length > 0) {
          store.getState().upsertPages(pages);
          const active = pages.find((p) => p.pageNumber === next) ?? pages[0];
          if (active?.chapterTitle) {
            store.getState().setChapterTitle(active.chapterTitle);
          }
        }
      } else {
        const active = state.loadedPages.find((p) => p.pageNumber === next);
        if (active?.chapterTitle) {
          store.getState().setChapterTitle(active.chapterTitle);
        }
      }
      await deps.readerService.updateBookProgress(state.document.bookHash, next, state.totalPages);
      if (onPageChanged) {
        await onPageChanged(next);
      }
    },

    async navigatePage(delta: number, onPageChanged) {
      const state = store.getState();
      const next = Math.max(1, Math.min(state.totalPages, state.currentPage + delta));
      await this.goToPage(next, onPageChanged);
    },
  };
}

export function useReaderPagination(
  options: UseReaderPaginationOptions = {}
): ReaderPaginationState {
  const { bookOverride, onBookLoaded, onPageChanged } = options;
  const { readerService, epubViewer } = useServiceContainer();
  const navigation = useNavigation();
  const book = bookOverride ?? navigation.selectedBook;

  const document = useReaderStore((s) => s.document);
  const currentPage = useReaderStore((s) => s.currentPage);
  const totalPages = useReaderStore((s) => s.totalPages);
  const chapterTitle = useReaderStore((s) => s.chapterTitle);
  const loadedPages = useReaderStore((s) => s.loadedPages);

  const controller = useMemo(
    () => createReaderPaginationController({ readerService, epubViewer }),
    [readerService, epubViewer]
  );

  const paragraphs = useMemo(() => {
    const active = loadedPages.find((p) => p.pageNumber === currentPage);
    if (active && active.paragraphs.length > 0) {
      return [...active.paragraphs];
    }
    return [document.sampleParagraph];
  }, [loadedPages, currentPage, document.sampleParagraph]);

  const onBookLoadedRef = useRef(onBookLoaded);
  onBookLoadedRef.current = onBookLoaded;

  const onPageChangedRef = useRef(onPageChanged);
  onPageChangedRef.current = onPageChanged;

  useEffect(() => {
    let cancelled = false;
    void controller.bootstrapBook(book, async (hash) => {
      if (!cancelled && onBookLoadedRef.current) {
        await onBookLoadedRef.current(hash);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [book, controller]);

  const loadMorePages = useCallback(
    async (direction: 'next' | 'prev') => {
      await controller.loadMorePages(direction);
    },
    [controller]
  );

  const onPageVisible = useCallback(
    (pageNumber: number) => {
      controller.onPageVisible(pageNumber);
    },
    [controller]
  );

  const goToPage = useCallback(
    async (targetPage: number) => {
      await controller.goToPage(targetPage, onPageChangedRef.current);
    },
    [controller]
  );

  const navigatePage = useCallback(
    async (delta: number) => {
      await controller.navigatePage(delta, onPageChangedRef.current);
    },
    [controller]
  );

  return {
    document,
    currentPage,
    totalPages,
    chapterTitle,
    paragraphs,
    loadedPages,
    navigatePage,
    goToPage,
    loadMorePages,
    onPageVisible,
  };
}
