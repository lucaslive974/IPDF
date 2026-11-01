import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BookMetadata } from '../../core/domain/BookMetadata';
import type { Highlight } from '../../core/domain/Highlight';
import type { TextFormatStyle } from '../../core/domain/types';
import type { DocumentPage } from '../../core/ports/IReaderService';
import { isValidAuthor } from '../components/library/BookCover';
import { getExpandedWordSelection } from '../components/reader/ReaderPageParagraphs';
import { useNavigation } from '../hooks/useNavigation';
import { useServiceContainer } from '../providers/ServiceContainerContext';
import { useHighlightStore } from '../stores/useHighlightStore';
import {
  DEFAULT_BOOK_HASH,
  DEFAULT_DOCUMENT,
  type StudyDocumentDescriptor,
  useReaderStore,
} from '../stores/useReaderStore';
import {
  type ActiveHighlightPopoverState,
  type SelectionPopoverState,
  useReaderUIStore,
} from '../stores/useReaderUIStore';
import { formatMarkdownSelection } from '../utils/markdownFormatting';
import { useReaderHighlights } from './useReaderHighlights';

export { DEFAULT_BOOK_HASH, DEFAULT_DOCUMENT };
export type { StudyDocumentDescriptor, SelectionPopoverState, ActiveHighlightPopoverState };

export const createEmptyRect = (): DOMRect =>
  ({
    x: 0,
    y: 0,
    width: 120,
    height: 20,
    top: 0,
    right: 120,
    bottom: 20,
    left: 0,
    toJSON: () => ({}),
  }) as DOMRect;

export interface ReaderViewModel {
  readonly document: StudyDocumentDescriptor;
  readonly currentPage: number;
  readonly totalPages: number;
  readonly chapterTitle: string;
  readonly paragraphs: string[];
  readonly loadedPages: readonly DocumentPage[];
  readonly highlights: readonly Highlight[];
  readonly selectedId: string | null;
  readonly noteInput: string;
  readonly selectionPopover: SelectionPopoverState | null;
  readonly activeHighlightPopover: ActiveHighlightPopoverState | null;
  readonly expandedHighlight: Highlight | null;
  readonly llmPromptPreview: string;

  navigatePage(delta: number): Promise<void>;
  goToPage(targetPage: number): Promise<void>;
  loadMorePages(direction: 'next' | 'prev'): Promise<void>;
  onPageVisible(pageNumber: number): void;
  getHighlightsForPage(pageNumber: number): Highlight[];
  selectHighlight(id: string): Promise<void>;
  setSelectionPopover(state: SelectionPopoverState | null): void;
  openHighlightPopover(highlight: Highlight, coords: { x: number; y: number }): void;
  closeHighlightPopover(): void;
  openExpandedStudio(highlight: Highlight): void;
  closeExpandedStudio(): void;
  createHighlightWithColor(
    colorHex: string,
    overrideText?: string,
    initialNote?: string,
    pageNumber?: number
  ): Promise<Highlight | null>;
  createHighlightFromCurrentSelection(colorHex: string): Promise<void>;
  changeHighlightColor(highlightId: string, colorHex: string): Promise<void>;
  deleteHighlight(highlightId: string): Promise<void>;
  updateNoteDraft(value: string): void;
  updateSelectionRange(start: number, end: number): void;
  applyAssistedFormat(style: TextFormatStyle): Promise<void>;
  generateContextualPrompt(customText?: string): Promise<void>;
}

export type ReaderContextValue = ReaderViewModel;

export function useReader(bookOverride?: BookMetadata | null): ReaderViewModel {
  const { readerService, highlightService, epubViewer } = useServiceContainer();
  const readerHighlights = useReaderHighlights(highlightService);
  const navigation = useNavigation();
  const book = bookOverride ?? navigation.selectedBook;

  // Stores
  const document = useReaderStore((s) => s.document);
  const currentPage = useReaderStore((s) => s.currentPage);
  const totalPages = useReaderStore((s) => s.totalPages);
  const chapterTitle = useReaderStore((s) => s.chapterTitle);
  const loadedPages = useReaderStore((s) => s.loadedPages);

  const setDocument = useReaderStore((s) => s.setDocument);
  const setCurrentPage = useReaderStore((s) => s.setCurrentPage);
  const setTotalPages = useReaderStore((s) => s.setTotalPages);
  const setChapterTitle = useReaderStore((s) => s.setChapterTitle);
  const setLoadedPages = useReaderStore((s) => s.setLoadedPages);
  const upsertPages = useReaderStore((s) => s.upsertPages);

  const highlights = useHighlightStore((s) => s.highlights);
  const selectedId = useHighlightStore((s) => s.selectedHighlightId);
  const noteInput = useHighlightStore((s) => s.noteInput);

  const upsertHighlight = useHighlightStore((s) => s.upsertHighlight);
  const removeHighlight = useHighlightStore((s) => s.removeHighlight);
  const setSelectedId = useHighlightStore((s) => s.setSelectedHighlightId);
  const setNoteInput = useHighlightStore((s) => s.setNoteInput);

  const selectionPopover = useReaderUIStore((s) => s.selectionPopover);
  const activeHighlightPopover = useReaderUIStore((s) => s.activeHighlightPopover);
  const expandedHighlight = useReaderUIStore((s) => s.expandedHighlight);

  const setSelectionPopover = useReaderUIStore((s) => s.setSelectionPopover);
  const openHighlightPopoverStore = useReaderUIStore((s) => s.openHighlightPopover);
  const closeHighlightPopover = useReaderUIStore((s) => s.closeHighlightPopover);
  const openExpandedStudioStore = useReaderUIStore((s) => s.openExpandedStudio);
  const closeExpandedStudio = useReaderUIStore((s) => s.closeExpandedStudio);

  // Local ViewModel state
  const [llmPromptPreview, setLlmPromptPreview] = useState<string>('');
  const [selectionRange, setSelectionRange] = useState<{ start: number; end: number }>({
    start: 0,
    end: 0,
  });

  const selectedIdRef = useRef<string | null>(selectedId);
  selectedIdRef.current = selectedId;

  const excerptCounterRef = useRef<number>(0);
  const isLoadingMoreRef = useRef<boolean>(false);

  // Derive active paragraphs from current page or first loaded page
  const paragraphs = useMemo(() => {
    const active = loadedPages.find((p) => p.pageNumber === currentPage);
    if (active && active.paragraphs.length > 0) {
      return [...active.paragraphs];
    }
    return [document.sampleParagraph];
  }, [loadedPages, currentPage, document.sampleParagraph]);

  // Refresh active highlight notes and annotations
  const refreshState = useCallback(
    async (activeHighlightId?: string | null, pageNum = currentPage) => {
      const pageHighlights = readerHighlights.getHighlightsForPage(pageNum);

      const targetId = activeHighlightId ?? selectedIdRef.current ?? pageHighlights[0]?.id ?? null;
      if (!targetId) {
        return;
      }

      selectedIdRef.current = targetId;
      setSelectedId(targetId);

      const found = pageHighlights.find((h) => h.id === targetId);
      if (found) {
        setNoteInput(found.note);
      }
    },
    [readerHighlights, currentPage, setNoteInput, setSelectedId]
  );

  // Bootstrap book & initial pages on mount or book change
  useEffect(() => {
    let cancelled = false;

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

    setDocument(doc);
    const initialPage = book?.currentPage || 1;
    setCurrentPage(initialPage);
    if (book?.totalPages) {
      setTotalPages(book.totalPages);
    }

    const bootstrapReader = async () => {
      try {
        const pages = await readerService.getBookPages(doc.bookHash, initialPage, 5);
        if (!cancelled && pages.length > 0) {
          setLoadedPages(pages);
          const first = pages[0];
          if (first?.chapterTitle) {
            setChapterTitle(first.chapterTitle);
          }
          epubViewer.setPages(pages);
          if (book?.totalPages) {
            setTotalPages(book.totalPages);
          }
        } else {
          const rawBytes = await readerService.readBookBinary(doc.bookHash);
          if (!cancelled && rawBytes.length > 0) {
            const container =
              typeof globalThis !== 'undefined' && globalThis.document?.createElement
                ? globalThis.document.createElement('div')
                : ({ innerHTML: '' } as unknown as HTMLElement);
            await epubViewer.render(container, rawBytes.buffer as ArrayBuffer);
            const chunk = epubViewer.getPagesChunk(initialPage, 5);
            if (chunk.length > 0) {
              setLoadedPages(chunk);
            }
            const info = epubViewer.getCurrentPage();
            if (info.totalPages > 0) {
              setTotalPages(info.totalPages);
            }
          }
        }
      } catch (err) {
        console.warn('Failed to load book pages in reader:', err);
      }

      await readerHighlights.loadBookHighlights(doc.bookHash);
      if (cancelled) return;
    };

    void bootstrapReader();

    return () => {
      cancelled = true;
    };
  }, [
    book,
    readerService,
    epubViewer,
    readerHighlights,
    setDocument,
    setCurrentPage,
    setTotalPages,
    setLoadedPages,
    setChapterTitle,
  ]);

  const loadMorePages = useCallback(
    async (direction: 'next' | 'prev') => {
      if (isLoadingMoreRef.current) return;
      isLoadingMoreRef.current = true;

      try {
        if (direction === 'next') {
          const lastPageNum =
            loadedPages.length > 0 ? Math.max(...loadedPages.map((p) => p.pageNumber)) : 0;
          if (lastPageNum >= totalPages) return;
          const nextPages = await readerService.getBookPages(document.bookHash, lastPageNum + 1, 5);
          if (nextPages.length === 0) return;
          upsertPages(nextPages);
        } else {
          const firstPageNum =
            loadedPages.length > 0 ? Math.min(...loadedPages.map((p) => p.pageNumber)) : 1;
          if (firstPageNum <= 1) return;
          const prevStart = Math.max(1, firstPageNum - 5);
          const prevCount = firstPageNum - prevStart;
          const prevPages = await readerService.getBookPages(
            document.bookHash,
            prevStart,
            prevCount
          );
          if (prevPages.length === 0) return;
          upsertPages(prevPages);
        }
      } catch (err) {
        console.warn('Failed to load more pages:', err);
      } finally {
        isLoadingMoreRef.current = false;
      }
    },
    [readerService, document.bookHash, loadedPages, totalPages, upsertPages]
  );

  const onPageVisible = useCallback(
    (pageNumber: number) => {
      if (pageNumber === currentPage) return;
      setCurrentPage(pageNumber);
      const visible = loadedPages.find((p) => p.pageNumber === pageNumber);
      if (visible?.chapterTitle) {
        setChapterTitle(visible.chapterTitle);
      }
      void readerService.updateBookProgress(document.bookHash, pageNumber, totalPages);
    },
    [
      readerService,
      currentPage,
      document.bookHash,
      loadedPages,
      setCurrentPage,
      setChapterTitle,
      totalPages,
    ]
  );

  const getHighlightsForPage = useCallback(
    (pageNumber: number): Highlight[] => {
      return readerHighlights.getHighlightsForPage(pageNumber);
    },
    [readerHighlights]
  );

  const goToPage = useCallback(
    async (targetPage: number) => {
      const next = Math.max(1, Math.min(totalPages, targetPage));
      setCurrentPage(next);
      const exists = loadedPages.some((p) => p.pageNumber === next);
      if (!exists) {
        const start = Math.max(1, next - 2);
        const count = Math.min(5, totalPages - start + 1);
        const pages = await readerService.getBookPages(document.bookHash, start, count);
        if (pages.length > 0) {
          upsertPages(pages);
          const active = pages.find((p) => p.pageNumber === next) ?? pages[0];
          if (active?.chapterTitle) {
            setChapterTitle(active.chapterTitle);
          }
        }
      } else {
        const active = loadedPages.find((p) => p.pageNumber === next);
        if (active?.chapterTitle) {
          setChapterTitle(active.chapterTitle);
        }
      }
      await readerService.updateBookProgress(document.bookHash, next, totalPages);
      await refreshState(null, next);
    },
    [
      readerService,
      document.bookHash,
      loadedPages,
      refreshState,
      setCurrentPage,
      setChapterTitle,
      totalPages,
      upsertPages,
    ]
  );

  const navigatePage = useCallback(
    async (delta: number) => {
      const next = Math.max(1, Math.min(totalPages, currentPage + delta));
      await goToPage(next);
    },
    [currentPage, goToPage, totalPages]
  );

  const selectHighlight = useCallback(
    async (id: string) => {
      await refreshState(id, currentPage);
    },
    [currentPage, refreshState]
  );

  const openHighlightPopover = useCallback(
    (highlight: Highlight, coords: { x: number; y: number }) => {
      selectedIdRef.current = highlight.id;
      setSelectedId(highlight.id);
      setNoteInput(highlight.note);
      openHighlightPopoverStore(highlight, coords);
    },
    [openHighlightPopoverStore, setNoteInput, setSelectedId]
  );

  const openExpandedStudio = useCallback(
    (highlight: Highlight) => {
      openExpandedStudioStore(highlight);
      closeHighlightPopover();
    },
    [closeHighlightPopover, openExpandedStudioStore]
  );

  const updateNoteDraft = useCallback(
    (value: string) => {
      setNoteInput(value);
      const currentId = selectedIdRef.current;
      if (currentId) {
        void readerHighlights.updateHighlightNote(currentId, value);
      }
    },
    [readerHighlights, setNoteInput]
  );

  const updateSelectionRange = useCallback((start: number, end: number) => {
    setSelectionRange({ start, end });
  }, []);

  const createHighlightWithColor = useCallback(
    async (
      colorHex: string,
      overrideText?: string,
      initialNote?: string,
      pageNumber = currentPage
    ): Promise<Highlight | null> => {
      const browserSel =
        typeof window !== 'undefined' ? getExpandedWordSelection(window.getSelection()) : '';
      const selected = overrideText?.trim() || selectionPopover?.text?.trim() || browserSel || '';

      if (!selected) {
        return null;
      }

      const created = await readerHighlights.createFromSelection(
        document.bookHash,
        {
          text: selected,
          surroundingContext: document.sampleParagraph,
          anchor: {
            format: 'epub',
            pageNumber,
            epubCfi: `epubcfi(/6/14!/4/2/${Date.now()}_${excerptCounterRef.current})`,
          },
          clientRect: createEmptyRect(),
        },
        colorHex,
        initialNote ?? 'Study note'
      );

      excerptCounterRef.current += 1;

      if (typeof window !== 'undefined') {
        window.getSelection()?.removeAllRanges();
      }
      setSelectionPopover(null);
      await refreshState(created.id, pageNumber);
      return created;
    },
    [readerHighlights, currentPage, document, refreshState, selectionPopover, setSelectionPopover]
  );

  const createHighlightFromCurrentSelection = useCallback(
    async (colorHex: string) => {
      const browserSel =
        typeof window !== 'undefined' ? getExpandedWordSelection(window.getSelection()) : '';
      await createHighlightWithColor(colorHex, browserSel);
    },
    [createHighlightWithColor]
  );

  const changeHighlightColor = useCallback(
    async (highlightId: string, colorHex: string) => {
      const target = highlights.find((h) => h.id === highlightId);
      if (!target) return;

      target.changeColor(colorHex);
      await highlightService.saveHighlight(target);
      upsertHighlight(target);
      await refreshState(highlightId, currentPage);
    },
    [highlightService, currentPage, highlights, refreshState, upsertHighlight]
  );

  const deleteHighlight = useCallback(
    async (highlightId: string) => {
      closeHighlightPopover();
      if (expandedHighlight?.id === highlightId) {
        closeExpandedStudio();
      }
      await readerHighlights.deleteHighlight(highlightId);
      await refreshState(null, currentPage);
    },
    [
      readerHighlights,
      closeExpandedStudio,
      closeHighlightPopover,
      currentPage,
      expandedHighlight?.id,
      refreshState,
    ]
  );

  const applyAssistedFormat = useCallback(
    async (style: TextFormatStyle) => {
      const activeId = selectedIdRef.current;
      if (!activeId) return;

      const range =
        selectionRange.end > selectionRange.start
          ? selectionRange
          : { start: 0, end: noteInput.length };

      const formatted = formatMarkdownSelection(noteInput, range, style);
      setNoteInput(formatted);
      setSelectionRange({ start: 0, end: 0 });
      await readerHighlights.updateHighlightNote(activeId, formatted);
      await refreshState(activeId, currentPage);
    },
    [readerHighlights, currentPage, noteInput, refreshState, selectionRange, setNoteInput]
  );

  const generateContextualPrompt = useCallback(
    async (customText?: string) => {
      const activeId = selectedIdRef.current;
      const active = highlights.find((h) => h.id === activeId);
      const textToQuery = customText ?? active?.text ?? 'noesis';
      const req = await readerService.buildTermLookupRequest(
        {
          bookTitle: document.bookTitle,
          bookAuthor: document.bookAuthor,
          chapterTitle: document.chapterTitle,
          selectedText: textToQuery,
          surroundingContext: document.sampleParagraph,
        },
        'en'
      );
      setLlmPromptPreview(JSON.stringify(req, null, 2));
    },
    [readerService, document, highlights]
  );

  return {
    document,
    currentPage,
    totalPages,
    chapterTitle,
    paragraphs,
    loadedPages,
    highlights,
    selectedId,
    noteInput,
    selectionPopover,
    activeHighlightPopover,
    expandedHighlight,
    llmPromptPreview,
    navigatePage,
    goToPage,
    loadMorePages,
    onPageVisible,
    getHighlightsForPage,
    selectHighlight,
    setSelectionPopover,
    openHighlightPopover,
    closeHighlightPopover,
    openExpandedStudio,
    closeExpandedStudio,
    createHighlightWithColor,
    createHighlightFromCurrentSelection,
    changeHighlightColor,
    deleteHighlight,
    updateNoteDraft,
    updateSelectionRange,
    applyAssistedFormat,
    generateContextualPrompt,
  };
}
