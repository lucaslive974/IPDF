import type { Highlight } from '@domain/Highlight';
import { create } from 'zustand';

export interface HighlightState {
  readonly highlights: readonly Highlight[];
  readonly highlightsByPage: ReadonlyMap<number, readonly Highlight[]>;
  readonly selectedHighlightId: string | null;
  readonly noteInput: string;

  setHighlights(highlights: readonly Highlight[]): void;
  upsertHighlight(highlight: Highlight): void;
  removeHighlight(id: string): void;
  setSelectedHighlightId(id: string | null): void;
  setNoteInput(noteInput: string): void;
  reset(): void;
}

function buildHighlightsByPage(
  highlights: readonly Highlight[]
): ReadonlyMap<number, readonly Highlight[]> {
  const map = new Map<number, Highlight[]>();
  for (const highlight of highlights) {
    const page = highlight.anchor.pageNumber;
    const list = map.get(page);
    if (list) {
      list.push(highlight);
    } else {
      map.set(page, [highlight]);
    }
  }
  return map;
}

function upsertHighlightInMap(
  current: ReadonlyMap<number, readonly Highlight[]>,
  highlight: Highlight,
  previous?: Highlight
): ReadonlyMap<number, readonly Highlight[]> {
  const next = new Map(current);
  const targetPage = highlight.anchor.pageNumber;

  if (previous && previous.anchor.pageNumber !== targetPage) {
    const prevList = next.get(previous.anchor.pageNumber);
    if (prevList) {
      const filtered = prevList.filter((h) => h.id !== highlight.id);
      if (filtered.length > 0) {
        next.set(previous.anchor.pageNumber, filtered);
      } else {
        next.delete(previous.anchor.pageNumber);
      }
    }
  }

  const pageList = next.get(targetPage) ?? [];
  const existsOnTarget = pageList.some((h) => h.id === highlight.id);
  next.set(
    targetPage,
    existsOnTarget
      ? pageList.map((h) => (h.id === highlight.id ? highlight : h))
      : [...pageList, highlight]
  );

  return next;
}

function removeHighlightFromMap(
  current: ReadonlyMap<number, readonly Highlight[]>,
  removed?: Highlight
): ReadonlyMap<number, readonly Highlight[]> {
  if (!removed) {
    return current;
  }

  const page = removed.anchor.pageNumber;
  const pageList = current.get(page);
  if (!pageList) {
    return current;
  }

  const next = new Map(current);
  const filtered = pageList.filter((h) => h.id !== removed.id);
  if (filtered.length > 0) {
    next.set(page, filtered);
  } else {
    next.delete(page);
  }
  return next;
}

export const useHighlightStore = create<HighlightState>((set) => ({
  highlights: [],
  highlightsByPage: new Map(),
  selectedHighlightId: null,
  noteInput: '',

  setHighlights: (highlights) =>
    set({
      highlights,
      highlightsByPage: buildHighlightsByPage(highlights),
    }),

  upsertHighlight: (highlight) =>
    set((state) => {
      const previous = state.highlights.find((h) => h.id === highlight.id);
      return {
        highlights: previous
          ? state.highlights.map((h) => (h.id === highlight.id ? highlight : h))
          : [...state.highlights, highlight],
        highlightsByPage: upsertHighlightInMap(state.highlightsByPage, highlight, previous),
      };
    }),

  removeHighlight: (id) =>
    set((state) => {
      const removed = state.highlights.find((h) => h.id === id);
      return {
        highlights: state.highlights.filter((h) => h.id !== id),
        highlightsByPage: removeHighlightFromMap(state.highlightsByPage, removed),
        selectedHighlightId: state.selectedHighlightId === id ? null : state.selectedHighlightId,
      };
    }),

  setSelectedHighlightId: (selectedHighlightId) =>
    set((state) => ({
      selectedHighlightId,
      noteInput:
        selectedHighlightId !== null
          ? (state.highlights.find((h) => h.id === selectedHighlightId)?.note ?? '')
          : '',
    })),

  setNoteInput: (noteInput) => set({ noteInput }),

  reset: () =>
    set({
      highlights: [],
      highlightsByPage: new Map(),
      selectedHighlightId: null,
      noteInput: '',
    }),
}));
