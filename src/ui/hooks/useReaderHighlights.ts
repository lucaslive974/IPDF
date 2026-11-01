import { useMemo } from 'react';
import { Highlight } from '../../core/domain/Highlight';
import type { TextSelection } from '../../core/domain/types';
import type { IHighlightService } from '../../core/ports/IHighlightService';
import { useServiceContainer } from '../providers/ServiceContainerContext';
import { useHighlightStore } from '../stores/useHighlightStore';

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

export function createReaderHighlightsController(
  highlightService: IHighlightService,
  store = useHighlightStore
): ReaderHighlightsController {
  return {
    get highlights(): readonly Highlight[] {
      return store.getState().highlights;
    },

    async loadBookHighlights(bookHash: string): Promise<Highlight[]> {
      const list = await highlightService.loadBookHighlights(bookHash);
      store.getState().setHighlights(list);
      return list;
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

export function useReaderHighlights(
  injectedHighlightService?: IHighlightService
): ReaderHighlightsController {
  const container = useServiceContainer();
  const highlightService = injectedHighlightService ?? container.highlightService;
  const highlights = useHighlightStore((s) => s.highlights);

  const controller = useMemo(
    () => createReaderHighlightsController(highlightService),
    [highlightService]
  );

  return {
    ...controller,
    highlights,
  };
}
