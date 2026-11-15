import { Highlight } from '@domain/Highlight';
import type { TextSelection } from '@domain/types';
import type { IHighlightService } from '@ports/IHighlightService';
import { useServiceContainer } from '@providers/ServiceContainerContext';
import { useHighlightStore } from '@stores/useHighlightStore';
import { useCallback, useMemo } from 'react';

export interface ReaderHighlightsController {
  readonly highlights: readonly Highlight[];
  loadBookHighlights(bookHash: string): Promise<Highlight[]>;
  createFromSelection(
    bookHash: string,
    selection: TextSelection,
    color?: string,
    initialNote?: string
  ): Promise<Highlight>;
  updateHighlightNote(id: string, note: string): Promise<Highlight>;
  updateHighlightColor(id: string, color: string): Promise<Highlight>;
  deleteHighlight(id: string): Promise<void>;
  getHighlightsForPage(pageNumber: number): Highlight[];
}

/**
 * Loads book highlights from the service and syncs them to the highlight store.
 */
export async function loadAndSyncBookHighlights(
  highlightService: IHighlightService,
  bookHash: string,
  store = useHighlightStore
): Promise<Highlight[]> {
  const list = await highlightService.loadBookHighlights(bookHash);
  store.getState().setHighlights(list);
  return list;
}

export function useReaderHighlights(): ReaderHighlightsController {
  const { highlightService } = useServiceContainer();
  return useMemo(() => createReaderHighlightsController(highlightService), [highlightService]);
}

export function createReaderHighlightsController(
  highlightService: IHighlightService,
  store = useHighlightStore
): ReaderHighlightsController {
  return {
    get highlights(): readonly Highlight[] {
      return store.getState().highlights;
    },

    loadBookHighlights(bookHash: string): Promise<Highlight[]> {
      return loadAndSyncBookHighlights(highlightService, bookHash, store);
    },

    async createFromSelection(
      bookHash: string,
      selection: TextSelection,
      color = '#FFEB3B',
      initialNote = ''
    ): Promise<Highlight> {
      const currentList = store.getState().highlights;
      for (const existing of currentList) {
        if (existing.overlapsWith(selection.anchor)) {
          existing.changeColor(color);
          if (initialNote) {
            existing.updateNote(initialNote);
          }
          await highlightService.saveHighlight(existing);
          store.getState().upsertHighlight(existing);
          return existing;
        }
      }

      const id = `hl_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const highlight = new Highlight(
        id,
        bookHash,
        selection.text,
        color,
        selection.anchor,
        initialNote
      );

      await highlightService.saveHighlight(highlight);
      store.getState().upsertHighlight(highlight);
      return highlight;
    },

    async updateHighlightNote(id: string, note: string): Promise<Highlight> {
      const currentList = store.getState().highlights;
      const highlight = currentList.find((h) => h.id === id);
      if (!highlight) {
        throw new Error(`Highlight not found: ${id}`);
      }

      highlight.updateNote(note);
      await highlightService.saveHighlight(highlight);
      store.getState().upsertHighlight(highlight);
      return highlight;
    },

    async updateHighlightColor(id: string, color: string): Promise<Highlight> {
      const currentList = store.getState().highlights;
      const highlight = currentList.find((h) => h.id === id);
      if (!highlight) {
        throw new Error(`Highlight not found: ${id}`);
      }

      highlight.changeColor(color);
      await highlightService.saveHighlight(highlight);
      store.getState().upsertHighlight(highlight);
      return highlight;
    },

    async deleteHighlight(id: string): Promise<void> {
      await highlightService.deleteHighlight(id);
      store.getState().removeHighlight(id);
    },

    getHighlightsForPage(pageNumber: number): Highlight[] {
      const currentList = store.getState().highlights;
      return currentList.filter((h) => h.anchor.pageNumber === pageNumber);
    },
  };
}

const EMPTY_PAGE_HIGHLIGHTS: readonly Highlight[] = [];

/**
 * Subscribes to the indexed highlights map and returns an O(1) lookup of highlights per page.
 * Untouched pages keep referential equality across updates.
 */
export function useHighlightsByPage(): (pageNumber: number) => readonly Highlight[] {
  const highlightsByPage = useHighlightStore((s) => s.highlightsByPage);

  return useCallback(
    (pageNumber: number) => highlightsByPage.get(pageNumber) ?? EMPTY_PAGE_HIGHLIGHTS,
    [highlightsByPage]
  );
}
