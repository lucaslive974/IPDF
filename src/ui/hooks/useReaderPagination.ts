import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { PdfPageProxy } from '../../adapters/viewers/IPdfEngine';
import type { BookMetadata } from '../../core/domain/BookMetadata';
import { BookFormat } from '../../core/domain/types';
import type { IDocumentViewer } from '../../core/ports/IDocumentViewer';
import type { ILibraryService } from '../../core/ports/ILibraryService';
import type { DocumentPage, IReaderService } from '../../core/ports/IReaderService';
import { isValidAuthor } from '../components/library/BookCover';
import { useNavigation } from '../hooks/useNavigation';
import { useServiceContainer } from '../providers/ServiceContainerContext';
import {
  EMPTY_DOCUMENT,
  type StudyDocumentDescriptor,
  useReaderStore,
} from '../stores/useReaderStore';
import { renderPdfPageToDataUrl } from '../utils/pdfCoverGenerator';

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
  readonly isLoadingPages: boolean;

  navigatePage(delta: number): Promise<void>;
  goToPage(targetPage: number): Promise<void>;
  loadMorePages(direction: 'next' | 'prev'): Promise<void>;
  onPageVisible(pageNumber: number): void;
}

export interface ReaderPaginationDependencies {
  readonly readerService: IReaderService;
  readonly libraryService?: ILibraryService;
  readonly getViewer?: (format: BookFormat) => IDocumentViewer;
  readonly epubViewer?: IDocumentViewer;
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

  const resolveViewer = (format: BookFormat): IDocumentViewer => {
    if (deps.getViewer) {
      return deps.getViewer(format);
    }
    if (deps.epubViewer) {
      return deps.epubViewer;
    }
    throw new Error('No document viewer available in dependencies');
  };

  return {
    async bootstrapBook(book, onBookLoaded) {
      store.getState().setLoadingPages(true);

      const doc: StudyDocumentDescriptor = book
        ? {
            bookHash: book.bookHash,
            bookTitle: book.title,
            bookAuthor: book.author,
            chapterTitle: `Chapter ${book.currentPage} &mdash; Reading Session`,
            sampleParagraph: isValidAuthor(book.author)
              ? `Reading "${book.title}" by ${book.author}. Select any passage in the text to create persistent highlights, add margin notes, or consult AI explanations.`
              : `Reading "${book.title}". Select any passage in the text to create persistent highlights, add margin notes, or consult AI explanations.`,
            coverImageUrl: book.coverImageUrl,
            format: book.format,
          }
        : EMPTY_DOCUMENT;

      store.getState().setDocument(doc);
      if (!doc.bookHash) {
        store.getState().setLoadingPages(false);
        return doc;
      }
      const initialPage = book?.currentPage || 1;
      store.getState().setCurrentPage(initialPage);
      if (book?.totalPages) {
        store.getState().setTotalPages(book.totalPages);
      }

      // Yield briefly to event loop so React can render the loading view
      await new Promise((resolve) => setTimeout(resolve, 0));

      const format = book?.format ?? BookFormat.EPUB;
      const viewer = resolveViewer(format);

      try {
        const pages = await deps.readerService.getBookPages(doc.bookHash, initialPage, 5);
        if (pages.length > 0) {
          store.getState().setLoadedPages(pages);
          const first = pages[0];
          if (first?.chapterTitle) {
            store.getState().setChapterTitle(first.chapterTitle);
          }
          viewer.setPages(pages);
          if (book?.totalPages) {
            store.getState().setTotalPages(book.totalPages);
          }
        }

        if (format === BookFormat.PDF || pages.length === 0) {
          const container =
            typeof globalThis !== 'undefined' && globalThis.document?.createElement
              ? globalThis.document.createElement('div')
              : ({ innerHTML: '' } as unknown as HTMLElement);

          let rendered = false;
          if (format === BookFormat.PDF && deps.readerService.getBookFilePath) {
            const filePath = await deps.readerService.getBookFilePath(doc.bookHash);
            if (filePath) {
              let assetUrl = filePath;
              try {
                const { convertFileSrc } = await import('@tauri-apps/api/core');
                assetUrl = convertFileSrc(filePath);
              } catch {
                assetUrl = filePath;
              }
              try {
                await viewer.render(container, assetUrl);
                rendered = true;
              } catch (err) {
                console.warn('Asset URL loading failed, falling back to binary:', err);
                rendered = false;
              }
            }
          }

          if (!rendered) {
            const rawBytes = await deps.readerService.readBookBinary(doc.bookHash);
            if (rawBytes.length > 0) {
              await viewer.render(container, rawBytes.buffer as ArrayBuffer);
            }
          }

          if ('ensurePagesExtracted' in viewer) {
            await (
              viewer as {
                ensurePagesExtracted(start: number, count: number): Promise<DocumentPage[]>;
              }
            ).ensurePagesExtracted(initialPage, 5);
          }
          const chunk = viewer.getPagesChunk(initialPage, 5);
          if (chunk.length > 0) {
            store.getState().setLoadedPages(chunk);
          }
          const info = viewer.getCurrentPage();
          if (info.totalPages > 0) {
            store.getState().setTotalPages(info.totalPages);
          }

          if (format === BookFormat.PDF && 'getPageProxy' in viewer) {
            const hasCover = doc.coverImageUrl?.startsWith('data:image/webp');
            if (!hasCover) {
              try {
                const pageProxy = await (
                  viewer as { getPageProxy(n: number): Promise<PdfPageProxy | null> }
                ).getPageProxy(1);
                if (pageProxy) {
                  const coverUrl = await renderPdfPageToDataUrl(pageProxy);
                  if (coverUrl) {
                    store.getState().setDocument({ ...doc, coverImageUrl: coverUrl });
                    if (deps.libraryService?.updateBookCover) {
                      void deps.libraryService.updateBookCover(doc.bookHash, coverUrl);
                    }
                  }
                }
              } catch (coverErr) {
                console.warn('Failed to extract PDF cover from page 1:', coverErr);
              }
            }
          }
        }
      } catch (err) {
        console.warn('Failed to load book pages in reader:', err);
      } finally {
        store.getState().setLoadingPages(false);
      }

      if (onBookLoaded) {
        await onBookLoaded(doc.bookHash);
      }

      const currentTotal = store.getState().totalPages;
      void deps.readerService.updateBookProgress(doc.bookHash, initialPage, currentTotal);

      return doc;
    },

    async loadMorePages(direction: 'next' | 'prev') {
      if (isLoadingMore) return;
      isLoadingMore = true;

      const state = store.getState();
      const format = state.document.format ?? BookFormat.EPUB;
      const viewer = resolveViewer(format);

      try {
        if (direction === 'next') {
          const lastPageNum =
            state.loadedPages.length > 0
              ? Math.max(...state.loadedPages.map((p) => p.pageNumber))
              : 0;
          if (lastPageNum >= state.totalPages) return;

          if (format === BookFormat.PDF && 'ensurePagesExtracted' in viewer) {
            const extracted = await (
              viewer as {
                ensurePagesExtracted(start: number, count: number): Promise<DocumentPage[]>;
              }
            ).ensurePagesExtracted(lastPageNum + 1, 5);
            if (extracted.length > 0) {
              store.getState().upsertPages(extracted);
              return;
            }
          }

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

          if (format === BookFormat.PDF && 'ensurePagesExtracted' in viewer) {
            const extracted = await (
              viewer as {
                ensurePagesExtracted(start: number, count: number): Promise<DocumentPage[]>;
              }
            ).ensurePagesExtracted(prevStart, prevCount);
            if (extracted.length > 0) {
              store.getState().upsertPages(extracted);
              return;
            }
          }

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
  const { readerService, libraryService, getViewer, epubViewer } = useServiceContainer();
  const navigation = useNavigation();
  const book = bookOverride ?? navigation.selectedBook;

  const document = useReaderStore((s) => s.document);
  const currentPage = useReaderStore((s) => s.currentPage);
  const totalPages = useReaderStore((s) => s.totalPages);
  const chapterTitle = useReaderStore((s) => s.chapterTitle);
  const loadedPages = useReaderStore((s) => s.loadedPages);
  const isLoadingPages = useReaderStore((s) => s.isLoadingPages);

  const controller = useMemo(
    () =>
      createReaderPaginationController({ readerService, libraryService, getViewer, epubViewer }),
    [readerService, libraryService, getViewer, epubViewer]
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
    isLoadingPages,
    navigatePage,
    goToPage,
    loadMorePages,
    onPageVisible,
  };
}
