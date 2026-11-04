import { isValidAuthor } from '@components/library/BookCover';
import type { BookMetadata } from '@domain/BookMetadata';
import { BookFormat } from '@domain/types';
import type { IDocumentViewer } from '@ports/IDocumentViewer';
import type { IEpubViewer } from '@ports/IEpubViewer';
import type { ILibraryService } from '@ports/ILibraryService';
import type { IPdfViewer } from '@ports/IPdfViewer';
import type { IReaderService } from '@ports/IReaderService';
import {
  EMPTY_DOCUMENT,
  type StudyDocumentDescriptor,
  useReaderStore,
} from '@stores/useReaderStore';
import { extractAndSyncPdfCover } from '@utils/pdfCoverGenerator';

export interface PageWindow {
  readonly startPage: number;
  readonly count: number;
}

export const INITIAL_BACKWARD_PAGES = 10;
export const INITIAL_ACTIVE_PAGES = 10;
export const INITIAL_FORWARD_PAGES = 10;

export interface ReaderBootstrapDependencies {
  readonly readerService: IReaderService;
  readonly libraryService?: ILibraryService;
  readonly getViewer?: (format: BookFormat) => IDocumentViewer;
  readonly epubViewer?: IEpubViewer;
  readonly pdfViewer?: IPdfViewer;
  readonly store?: typeof useReaderStore;
}

/**
 * Calculates the initial window of pages to fetch around the starting page.
 */
export function calculateInitialPageWindow(initialPage: number, totalPages?: number): PageWindow {
  const backwardMargin = initialPage > 1 ? Math.min(INITIAL_BACKWARD_PAGES, initialPage - 1) : 0;
  const startPage = Math.max(1, initialPage - backwardMargin);
  const initialChunkSize = backwardMargin + INITIAL_ACTIVE_PAGES + INITIAL_FORWARD_PAGES;
  const count = Math.min(
    initialChunkSize,
    totalPages ? totalPages - startPage + 1 : initialChunkSize
  );
  return { startPage, count };
}

/**
 * Creates the initial study document descriptor from book metadata.
 */
export function createStudyDocumentDescriptor(book?: BookMetadata | null): StudyDocumentDescriptor {
  if (!book) {
    return EMPTY_DOCUMENT;
  }
  return {
    bookHash: book.bookHash,
    bookTitle: book.title,
    bookAuthor: book.author,
    chapterTitle: `Chapter ${book.currentPage} &mdash; Reading Session`,
    sampleParagraph: isValidAuthor(book.author)
      ? `Reading "${book.title}" by ${book.author}. Select any passage in the text to create persistent highlights, add margin notes, or consult AI explanations.`
      : `Reading "${book.title}". Select any passage in the text to create persistent highlights, add margin notes, or consult AI explanations.`,
    coverImageUrl: book.coverImageUrl,
    format: book.format,
  };
}

/**
 * Resolves the appropriate document viewer based on format and injected dependencies.
 */
export function resolveDocumentViewer(
  deps: ReaderBootstrapDependencies,
  format: BookFormat
): IDocumentViewer {
  if (deps.getViewer) {
    return deps.getViewer(format);
  }
  if (deps.epubViewer) {
    return deps.epubViewer;
  }
  throw new Error('No document viewer available in dependencies');
}

/**
 * Resolves the PDF viewer instance.
 */
export function resolvePdfViewer(deps: ReaderBootstrapDependencies): IPdfViewer {
  if (deps.pdfViewer) {
    return deps.pdfViewer;
  }
  return resolveDocumentViewer(deps, BookFormat.PDF) as IPdfViewer;
}

/**
 * Renders the document in the given viewer using either asset URL (Tauri) or binary array.
 */
export async function renderDocumentInViewer(
  viewer: IDocumentViewer,
  readerService: IReaderService,
  bookHash: string,
  format: BookFormat
): Promise<boolean> {
  const container =
    typeof globalThis !== 'undefined' && globalThis.document?.createElement
      ? globalThis.document.createElement('div')
      : ({ innerHTML: '' } as unknown as HTMLElement);

  if (format === BookFormat.PDF && readerService.getBookFilePath) {
    const filePath = await readerService.getBookFilePath(bookHash);
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
        return true;
      } catch (err) {
        console.warn('Asset URL loading failed, falling back to binary:', err);
      }
    }
  }

  const rawBytes = await readerService.readBookBinary(bookHash);
  if (rawBytes.length > 0) {
    await viewer.render(container, rawBytes.buffer as ArrayBuffer);
    return true;
  }
  return false;
}

/**
 * Orchestrates the full bootstrap sequence when opening a book in the reader.
 */
export async function bootstrapReaderBook(
  deps: ReaderBootstrapDependencies,
  book?: BookMetadata | null,
  onBookLoaded?: (hash: string) => Promise<void> | void
): Promise<StudyDocumentDescriptor> {
  const store = deps.store ?? useReaderStore;
  store.getState().setLoadingPages(true);

  const doc = createStudyDocumentDescriptor(book);
  store.getState().setDocument(doc);

  if (!doc.bookHash) {
    store.getState().setLoadingPages(false);
    return doc;
  }

  const initialPage = book?.currentPage || 1;
  store.getState().setCurrentPage(initialPage);
  store.getState().setPageOffsetRatio(book?.pageOffsetRatio ?? 0.0);
  if (book?.totalPages) {
    store.getState().setTotalPages(book.totalPages);
  }

  // Yield briefly to event loop so React can render the loading view
  await new Promise((resolve) => setTimeout(resolve, 0));

  const format = book?.format ?? BookFormat.EPUB;
  const viewer = resolveDocumentViewer(deps, format);
  const window = calculateInitialPageWindow(initialPage, book?.totalPages);

  try {
    const pages = await deps.readerService.getBookPages(
      doc.bookHash,
      window.startPage,
      window.count
    );

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
      await renderDocumentInViewer(viewer, deps.readerService, doc.bookHash, format);

      if (format === BookFormat.PDF) {
        const pdfViewer = resolvePdfViewer(deps);
        const chunk = pdfViewer.getPagesChunk(window.startPage, window.count);
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

        const coverUrl = await extractAndSyncPdfCover(pdfViewer, doc, deps.libraryService);
        if (coverUrl && coverUrl !== doc.coverImageUrl) {
          store.getState().setDocument({ ...doc, coverImageUrl: coverUrl });
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
  void deps.readerService.updateBookProgress(
    doc.bookHash,
    initialPage,
    currentTotal,
    book?.pageOffsetRatio ?? 0.0
  );

  return doc;
}
