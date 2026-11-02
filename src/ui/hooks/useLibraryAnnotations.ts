import type { BookMetadata } from '@domain/BookMetadata';
import type { Highlight } from '@domain/Highlight';
import { useNavigation } from '@hooks/useNavigation';
import type { IHighlightService } from '@ports/IHighlightService';
import { useServiceContainer } from '@providers/ServiceContainerContext';
import { useLibraryStore } from '@stores/useLibraryStore';
import { useReaderStore } from '@stores/useReaderStore';
import { useCallback, useEffect, useMemo, useState } from 'react';

export interface BookAnnotationGroup {
  readonly bookHash: string;
  readonly bookTitle: string;
  readonly bookAuthor: string;
  readonly coverImageUrl?: string;
  readonly format: 'pdf' | 'epub';
  readonly highlights: readonly Highlight[];
}

export interface BookFilterOption {
  readonly value: string;
  readonly label: string;
}

export interface UseLibraryAnnotationsOptions {
  readonly searchQuery?: string;
}

export interface LibraryAnnotationsControllerDeps {
  readonly highlightService: IHighlightService;
  readonly books: readonly BookMetadata[];
  readonly openReader?: (book: BookMetadata) => void;
}

export interface LibraryAnnotationsController {
  readonly highlights: readonly Highlight[];
  readonly searchQuery: string;
  readonly selectedBookHash: string | 'all';
  readonly onlyWithNotes: boolean;
  loadHighlights(): Promise<Highlight[]>;
  setSearchQuery(query: string): void;
  setSelectedBookHash(bookHash: string | 'all'): void;
  setOnlyWithNotes(onlyWithNotes: boolean): void;
  getGroupedByBook(): BookAnnotationGroup[];
  deleteHighlight(id: string): Promise<void>;
  jumpToReader(highlight: Highlight): void;
}

export function formatQuoteForClipboard(highlight: Highlight, book?: BookMetadata): string {
  const title = book?.title ?? 'Unknown Book';
  const author = book?.author ? ` - ${book.author}` : '';
  const page = highlight.anchor.pageNumber ? ` (p. ${highlight.anchor.pageNumber})` : '';

  let formatted = `"${highlight.text}"\n— ${title}${author}${page}`;
  if (highlight.note.trim()) {
    formatted += `\n\nNote: ${highlight.note.trim()}`;
  }
  return formatted;
}

export function createLibraryAnnotationsController(
  deps: LibraryAnnotationsControllerDeps
): LibraryAnnotationsController {
  let localHighlights: Highlight[] = [];
  let query = '';
  let bookHashFilter: string | 'all' = 'all';
  let notesOnly = false;

  return {
    get highlights(): readonly Highlight[] {
      return localHighlights;
    },

    get searchQuery(): string {
      return query;
    },

    get selectedBookHash(): string | 'all' {
      return bookHashFilter;
    },

    get onlyWithNotes(): boolean {
      return notesOnly;
    },

    async loadHighlights(): Promise<Highlight[]> {
      const list = await deps.highlightService.loadAllHighlights();
      localHighlights = [...list];
      return localHighlights;
    },

    setSearchQuery(newQuery: string): void {
      query = newQuery;
    },

    setSelectedBookHash(newHash: string | 'all'): void {
      bookHashFilter = newHash;
    },

    setOnlyWithNotes(flag: boolean): void {
      notesOnly = flag;
    },

    getGroupedByBook(): BookAnnotationGroup[] {
      const lowerQuery = query.trim().toLowerCase();
      const booksMap = new Map<string, BookMetadata>();
      for (const b of deps.books) {
        booksMap.set(b.bookHash, b);
      }

      // Group highlights by bookHash
      const groupedMap = new Map<string, Highlight[]>();
      for (const hl of localHighlights) {
        // Book filter
        if (bookHashFilter !== 'all' && hl.bookHash !== bookHashFilter) {
          continue;
        }

        // Notes only filter
        if (notesOnly && !hl.note.trim()) {
          continue;
        }

        // Search query filter
        const book = booksMap.get(hl.bookHash);
        const bookTitle = book?.title ?? '';
        if (lowerQuery) {
          const matchQuote = hl.text.toLowerCase().includes(lowerQuery);
          const matchNote = hl.note.toLowerCase().includes(lowerQuery);
          const matchBook = bookTitle.toLowerCase().includes(lowerQuery);
          if (!matchQuote && !matchNote && !matchBook) {
            continue;
          }
        }

        const existing = groupedMap.get(hl.bookHash) ?? [];
        existing.push(hl);
        groupedMap.set(hl.bookHash, existing);
      }

      const groups: BookAnnotationGroup[] = [];
      for (const [bookHash, hls] of Array.from(groupedMap.entries())) {
        const book = booksMap.get(bookHash);
        groups.push({
          bookHash,
          bookTitle: book?.title ?? 'Unknown Book',
          bookAuthor: book?.author ?? 'Unknown Author',
          coverImageUrl: book?.coverImageUrl,
          format: book?.format ?? 'epub',
          highlights: hls.sort((a, b) => a.anchor.pageNumber - b.anchor.pageNumber),
        });
      }

      return groups;
    },

    async deleteHighlight(id: string): Promise<void> {
      await deps.highlightService.deleteHighlight(id);
      localHighlights = localHighlights.filter((h) => h.id !== id);
    },

    jumpToReader(highlight: Highlight): void {
      const book = deps.books.find((b) => b.bookHash === highlight.bookHash);
      if (!book) return;

      useReaderStore.getState().setDocument({
        bookHash: book.bookHash,
        bookTitle: book.title,
        bookAuthor: book.author,
        chapterTitle: `Page ${highlight.anchor.pageNumber}`,
        sampleParagraph: highlight.text,
        coverImageUrl: book.coverImageUrl,
      });
      useReaderStore.getState().setCurrentPage(highlight.anchor.pageNumber);

      if (deps.openReader) {
        deps.openReader(book);
      }
    },
  };
}

export function useLibraryAnnotations({
  searchQuery: propSearchQuery = '',
}: UseLibraryAnnotationsOptions = {}) {
  const { highlightService, presenceService } = useServiceContainer();
  const { books } = useLibraryStore();
  const { openReader } = useNavigation();

  const [highlights, setHighlights] = useState<readonly Highlight[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState(propSearchQuery);
  const [selectedBookHash, setSelectedBookHash] = useState<string | 'all'>('all');
  const [onlyWithNotes, setOnlyWithNotes] = useState(false);
  const [copiedHighlightId, setCopiedHighlightId] = useState<string | null>(null);

  // Sync external search query
  useEffect(() => {
    setSearchQuery(propSearchQuery);
  }, [propSearchQuery]);

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await highlightService.loadAllHighlights();
      setHighlights(list);
    } finally {
      setIsLoading(false);
    }
  }, [highlightService]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const controller = useMemo(
    () =>
      createLibraryAnnotationsController({
        highlightService,
        books,
        openReader,
      }),
    [highlightService, books, openReader]
  );

  // Sync state to controller
  useEffect(() => {
    controller.setSearchQuery(searchQuery);
    controller.setSelectedBookHash(selectedBookHash);
    controller.setOnlyWithNotes(onlyWithNotes);
  }, [controller, searchQuery, selectedBookHash, onlyWithNotes]);

  const groupedByBook = useMemo(() => {
    // We recreate controller with current loaded highlights
    const ctrl = createLibraryAnnotationsController({
      highlightService,
      books,
      openReader,
    });
    // load local highlights into ctrl
    ctrl as unknown as { loadFromList(l: readonly Highlight[]): void };
    ctrl.setSearchQuery(searchQuery);
    ctrl.setSelectedBookHash(selectedBookHash);
    ctrl.setOnlyWithNotes(onlyWithNotes);

    // populate internal list:
    const lowerQuery = searchQuery.trim().toLowerCase();
    const booksMap = new Map<string, BookMetadata>();
    for (const b of books) {
      booksMap.set(b.bookHash, b);
    }

    const groupedMap = new Map<string, Highlight[]>();
    for (const hl of highlights) {
      if (selectedBookHash !== 'all' && hl.bookHash !== selectedBookHash) {
        continue;
      }
      if (onlyWithNotes && !hl.note.trim()) {
        continue;
      }
      const book = booksMap.get(hl.bookHash);
      const bookTitle = book?.title ?? '';
      if (lowerQuery) {
        const matchQuote = hl.text.toLowerCase().includes(lowerQuery);
        const matchNote = hl.note.toLowerCase().includes(lowerQuery);
        const matchBook = bookTitle.toLowerCase().includes(lowerQuery);
        if (!matchQuote && !matchNote && !matchBook) {
          continue;
        }
      }
      const existing = groupedMap.get(hl.bookHash) ?? [];
      existing.push(hl);
      groupedMap.set(hl.bookHash, existing);
    }

    const groups: BookAnnotationGroup[] = [];
    for (const [bookHash, hls] of Array.from(groupedMap.entries())) {
      const book = booksMap.get(bookHash);
      groups.push({
        bookHash,
        bookTitle: book?.title ?? 'Unknown Book',
        bookAuthor: book?.author ?? 'Unknown Author',
        coverImageUrl: book?.coverImageUrl,
        format: book?.format ?? 'epub',
        highlights: hls.sort((a, b) => a.anchor.pageNumber - b.anchor.pageNumber),
      });
    }
    return groups;
  }, [
    highlights,
    books,
    openReader,
    highlightService,
    searchQuery,
    selectedBookHash,
    onlyWithNotes,
  ]);

  const deleteHighlight = useCallback(
    async (id: string) => {
      await highlightService.deleteHighlight(id);
      setHighlights((prev) => prev.filter((h) => h.id !== id));
    },
    [highlightService]
  );

  const jumpToReader = useCallback(
    (highlight: Highlight) => {
      controller.jumpToReader(highlight);
    },
    [controller]
  );

  const copyQuote = useCallback(
    async (highlight: Highlight) => {
      const book = books.find((b) => b.bookHash === highlight.bookHash);
      const formatted = formatQuoteForClipboard(highlight, book);
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(formatted);
      }
      setCopiedHighlightId(highlight.id);
      setTimeout(() => setCopiedHighlightId(null), 2000);
    },
    [books]
  );

  const totalAnnotationsCount = useMemo(
    () => groupedByBook.reduce((acc, g) => acc + g.highlights.length, 0),
    [groupedByBook]
  );

  // Sync Discord presence
  useEffect(() => {
    void presenceService.updateAnnotationsPresence(totalAnnotationsCount);
  }, [totalAnnotationsCount, presenceService]);

  const bookFilterOptions = useMemo<readonly BookFilterOption[]>(
    () => [
      { value: 'all', label: 'All Books' },
      ...books.map((b) => ({ value: b.bookHash, label: b.title })),
    ],
    [books]
  );

  const isEmptyLibrary = !isLoading && highlights.length === 0;
  const isFilterEmpty = !isEmptyLibrary && groupedByBook.length === 0;

  const resetFilters = useCallback(() => {
    setSelectedBookHash('all');
    setOnlyWithNotes(false);
    setSearchQuery('');
  }, []);

  return {
    highlights,
    groupedByBook,
    isLoading,
    isEmptyLibrary,
    isFilterEmpty,
    searchQuery,
    selectedBookHash,
    onlyWithNotes,
    bookFilterOptions,
    copiedHighlightId,
    totalAnnotationsCount,
    setSearchQuery,
    setSelectedBookHash,
    setOnlyWithNotes,
    resetFilters,
    deleteHighlight,
    jumpToReader,
    copyQuote,
    refreshHighlights: loadAll,
  };
}
