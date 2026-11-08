import { isValidAuthor } from '@components/library/BookCover';
import type { BookMetadata } from '@domain/BookMetadata';
import { type PageWindow, calculatePageWindow } from '@domain/PageWindow';
import { BookFormat } from '@domain/types';
import type { IDocumentViewer } from '@ports/IDocumentViewer';
import type { IEpubViewer } from '@ports/IEpubViewer';
import type { IHighlightService } from '@ports/IHighlightService';
import type { ILibraryService } from '@ports/ILibraryService';
import type { IPdfViewer } from '@ports/IPdfViewer';
import type { IPresenceService } from '@ports/IPresenceService';
import type { IReaderService } from '@ports/IReaderService';
import {
  EMPTY_DOCUMENT,
  type StudyDocumentDescriptor,
  useReaderStore,
} from '@stores/useReaderStore';
import { extractAndSyncPdfCover } from '@utils/pdfCoverGenerator';
import { loadAndSyncBookHighlights } from './useReaderHighlights';

export interface ReaderBootstrapDependencies {
  readonly readerService: IReaderService;
  readonly libraryService?: ILibraryService;
  readonly presenceService?: IPresenceService;
  readonly highlightService?: IHighlightService;
  readonly getViewer?: (format: BookFormat) => IDocumentViewer;
  readonly epubViewer?: IEpubViewer;
  readonly pdfViewer?: IPdfViewer;
  readonly store?: typeof useReaderStore;
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
    chapterTitle: `Chapter ${book.currentPage} Reading Session`,
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
  bookHash: string
): Promise<void> {
  const container = globalThis.document?.createElement
    ? globalThis.document.createElement('div')
    : ({ innerHTML: '' } as unknown as HTMLElement);

  const filePath = await readerService.getBookFilePath(bookHash);
  if (filePath) {
    let assetUrl = filePath;
    try {
      const { convertFileSrc } = await import('@tauri-apps/api/core');
      assetUrl = convertFileSrc(filePath);
    } catch {
      assetUrl = filePath;
    }
    await viewer.render(container, assetUrl);
    return;
  }

  const rawBytes = await readerService.readBookBinary(bookHash);
  if (rawBytes.length > 0) {
    await viewer.render(container, rawBytes.buffer as ArrayBuffer);
    return;
  }
}

/**
 * Bootstraps the PDF reader session: renders document in viewer, extracts page chunk and syncs cover.
 */
export async function bootstrapPdfReaderSession(
  deps: ReaderBootstrapDependencies,
  viewer: IDocumentViewer,
  doc: StudyDocumentDescriptor,
  window: PageWindow,
  initialPage: number,
  store: typeof useReaderStore = deps.store ?? useReaderStore
): Promise<void> {
  await renderDocumentInViewer(viewer, deps.readerService, doc.bookHash);

  const pdfViewer = resolvePdfViewer(deps);
  const info = pdfViewer.getCurrentPage();
  store.getState().setTotalPages(info.totalPages);

  let chunk = pdfViewer.getPagesChunk(window.startPage, window.count);
  if (chunk.length === 0) {
    chunk = await deps.readerService.getBookPages(doc.bookHash, window.startPage, window.count);
  }

  store.getState().setLoadedPages(chunk);
  const active = chunk.find((p) => p.pageNumber === initialPage) ?? chunk[0];
  if (active?.chapterTitle) {
    store.getState().setChapterTitle(active.chapterTitle);
  }

  void extractAndSyncPdfCover(pdfViewer, doc, deps.libraryService).then((coverUrl) => {
    if (coverUrl && coverUrl !== doc.coverImageUrl) {
      const currentDoc = store.getState().document;
      if (currentDoc.bookHash === doc.bookHash) {
        store.getState().setDocument({ ...currentDoc, coverImageUrl: coverUrl });
      }
    }
  });
}

/**
 * Bootstraps the EPUB reader session: fetches pre-paginated chunks or falls back to binary viewer rendering.
 */
export async function bootstrapEpubReaderSession(
  deps: ReaderBootstrapDependencies,
  viewer: IDocumentViewer,
  doc: StudyDocumentDescriptor,
  window: PageWindow,
  initialPage: number,
  book?: BookMetadata | null,
  store: typeof useReaderStore = deps.store ?? useReaderStore
): Promise<void> {
  const pages = await deps.readerService.getBookPages(doc.bookHash, window.startPage, window.count);

  store.getState().setLoadedPages(pages);
  const active = pages.find((p) => p.pageNumber === initialPage) ?? pages[0];
  if (active?.chapterTitle) {
    store.getState().setChapterTitle(active.chapterTitle);
  }

  viewer.setPages(pages);
  store.getState().setTotalPages(book?.totalPages ?? 0);

  store.getState().setStreamReady(true);
}

/**
 * Orchestrates the full bootstrap sequence when opening a book in the reader.
 */
export async function bootstrapReaderBook(
  deps: ReaderBootstrapDependencies,
  book?: BookMetadata | null
): Promise<StudyDocumentDescriptor> {
  const store = deps.store ?? useReaderStore;
  store.getState().setLoadedPages([]);
  store.getState().setLoadingPages(true);
  store.getState().setStreamReady(false);

  const doc = createStudyDocumentDescriptor(book);
  store.getState().setDocument(doc);

  if (!doc.bookHash) {
    store.getState().setLoadingPages(false);
    store.getState().setStreamReady(true);
    return doc;
  }

  const initialPage = book?.currentPage || 1;
  const initialOffset = book?.pageOffsetRatio ?? 0.0;
  store.getState().setCurrentPage(initialPage);
  store.getState().setPageOffsetRatio(initialOffset);
  store.getState().setTotalPages(book?.totalPages ?? 0);

  const format = book?.format ?? BookFormat.EPUB;
  const viewer = resolveDocumentViewer(deps, format);
  const window = calculatePageWindow(initialPage, book?.totalPages);

  try {
    if (format === BookFormat.PDF) {
      await bootstrapPdfReaderSession(deps, viewer, doc, window, initialPage, store);
    } else {
      await bootstrapEpubReaderSession(deps, viewer, doc, window, initialPage, book, store);
    }
  } catch (err) {
    console.warn('Failed to load book pages in reader:', err);
    store.getState().setStreamReady(true);
  } finally {
    store.getState().setLoadingPages(false);
  }

  if (deps.highlightService && doc.bookHash) {
    await loadAndSyncBookHighlights(deps.highlightService, doc.bookHash);
  }

  const finalState = store.getState();
  void deps.presenceService?.updateReadingPresence({
    bookHash: doc.bookHash,
    bookTitle: doc.bookTitle,
    bookAuthor: doc.bookAuthor,
    chapterTitle: finalState.chapterTitle,
    currentPage: initialPage,
    totalPages: finalState.totalPages,
  });

  return doc;
}
