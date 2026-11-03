import { isValidAuthor } from '@components/library/BookCover';
import type { BookMetadata } from '@domain/BookMetadata';
import { BookFormat } from '@domain/types';
import type { IDocumentViewer } from '@ports/IDocumentViewer';
import type { ILibraryService } from '@ports/ILibraryService';
import type { IPdfViewer } from '@ports/IPdfViewer';
import type { DocumentPage, IReaderService } from '@ports/IReaderService';
import { useNavigation } from '@providers/NavigationContext';
import { useServiceContainer } from '@providers/ServiceContainerContext';
import {
  EMPTY_DOCUMENT,
  type StudyDocumentDescriptor,
  useReaderStore,
} from '@stores/useReaderStore';
import { renderPdfPageToDataUrl } from '@utils/pdfCoverGenerator';
import { useCallback, useEffect, useMemo, useRef } from 'react';

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
  readonly pdfViewer?: IPdfViewer;
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

const INITIAL_BACKWARD_PAGES = 10;
const INITIAL_ACTIVE_PAGES = 10;
const INITIAL_FORWARD_PAGES = 10;
const PAGINATION_CHUNK_SIZE = 10;
const PREFETCH_PAGES_TRIGGER_DISTANCE = 7;

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

  const resolvePdfViewer = (): IPdfViewer => {
    if (deps.pdfViewer) {
      return deps.pdfViewer;
    }
    return resolveViewer(BookFormat.PDF) as IPdfViewer;
  };

  const loadMorePagesInternal = async (direction: 'next' | 'prev'): Promise<void> => {
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
        const nextCount = Math.min(PAGINATION_CHUNK_SIZE, state.totalPages - lastPageNum);

        if (format === BookFormat.PDF) {
          const pdfViewer = resolvePdfViewer();
          const extracted = await pdfViewer.ensurePagesExtracted(lastPageNum + 1, nextCount);
          if (extracted.length > 0) {
            store.getState().upsertPages(extracted);
            return;
          }
        }

        const nextPages = await deps.readerService.getBookPages(
          state.document.bookHash,
          lastPageNum + 1,
          nextCount
        );
        if (nextPages.length === 0) return;
        store.getState().upsertPages(nextPages);
      } else {
        const firstPageNum =
          state.loadedPages.length > 0
            ? Math.min(...state.loadedPages.map((p) => p.pageNumber))
            : 1;
        if (firstPageNum <= 1) return;
        const prevStart = Math.max(1, firstPageNum - PAGINATION_CHUNK_SIZE);
        const prevCount = firstPageNum - prevStart;

        if (format === BookFormat.PDF) {
          const pdfViewer = resolvePdfViewer();
          const extracted = await pdfViewer.ensurePagesExtracted(prevStart, prevCount);
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

      const backwardMargin =
        initialPage > 1 ? Math.min(INITIAL_BACKWARD_PAGES, initialPage - 1) : 0;
      const startPage = Math.max(1, initialPage - backwardMargin);
      const initialChunkSize = backwardMargin + INITIAL_ACTIVE_PAGES + INITIAL_FORWARD_PAGES;
      const count = Math.min(
        initialChunkSize,
        book?.totalPages ? book.totalPages - startPage + 1 : initialChunkSize
      );

      try {
        const pages = await deps.readerService.getBookPages(doc.bookHash, startPage, count);
        if (pages.length > 0) {
          store.getState().setLoadedPages(pages);
          const active = pages.find((p) => p.pageNumber === initialPage) ?? pages[0];
          if (active?.chapterTitle) {
            store.getState().setChapterTitle(active.chapterTitle);
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

          if (format === BookFormat.PDF) {
            const pdfViewer = resolvePdfViewer();
            await pdfViewer.ensurePagesExtracted(startPage, count);
            const chunk = pdfViewer.getPagesChunk(startPage, count);
            if (chunk.length > 0) {
              store.getState().setLoadedPages(chunk);
              const active = chunk.find((p) => p.pageNumber === initialPage) ?? chunk[0];
              if (active?.chapterTitle) {
                store.getState().setChapterTitle(active.chapterTitle);
              }
            }
            const info = pdfViewer.getCurrentPage();
            if (info.totalPages > 0) {
              store.getState().setTotalPages(info.totalPages);
            }

            const hasCover = doc.coverImageUrl?.startsWith('data:image/webp');
            if (!hasCover) {
              try {
                const pageProxy = await pdfViewer.getPageProxy(1);
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

    loadMorePages: loadMorePagesInternal,

    onPageVisible(pageNumber: number) {
      const state = store.getState();
      const previousPage = state.currentPage;
      if (pageNumber !== previousPage) {
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
      }

      // Proactively load more pages when within 7 pages of loaded boundaries
      if (state.loadedPages.length > 0) {
        const lastLoaded = Math.max(...state.loadedPages.map((p) => p.pageNumber));
        const firstLoaded = Math.min(...state.loadedPages.map((p) => p.pageNumber));

        const nearEnd =
          lastLoaded < state.totalPages &&
          lastLoaded - pageNumber <= PREFETCH_PAGES_TRIGGER_DISTANCE;
        const nearStart =
          firstLoaded > 1 && pageNumber - firstLoaded <= PREFETCH_PAGES_TRIGGER_DISTANCE;

        if (nearStart && nearEnd) {
          // If close to both ends, prioritize the direction the user is moving
          if (pageNumber < previousPage) {
            void loadMorePagesInternal('prev');
          } else {
            void loadMorePagesInternal('next');
          }
        } else if (nearEnd) {
          void loadMorePagesInternal('next');
        } else if (nearStart) {
          void loadMorePagesInternal('prev');
        }
      }
    },

    async goToPage(targetPage: number, onPageChanged) {
      const state = store.getState();
      const next = Math.max(1, Math.min(state.totalPages, targetPage));
      store.getState().setCurrentPage(next);
      const exists = state.loadedPages.some((p) => p.pageNumber === next);
      if (!exists) {
        const backwardMargin = next > 1 ? Math.min(INITIAL_BACKWARD_PAGES, next - 1) : 0;
        const start = Math.max(1, next - backwardMargin);
        const count = Math.min(
          backwardMargin + INITIAL_ACTIVE_PAGES + INITIAL_FORWARD_PAGES,
          state.totalPages - start + 1
        );
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
  const { readerService, libraryService, getViewer, epubViewer, pdfViewer } = useServiceContainer();
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
      createReaderPaginationController({
        readerService,
        libraryService,
        getViewer,
        epubViewer,
        pdfViewer,
      }),
    [readerService, libraryService, getViewer, epubViewer, pdfViewer]
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
