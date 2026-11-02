import type { Highlight } from '@domain/Highlight';
import { create } from 'zustand';

export interface HighlightState {
  readonly highlights: readonly Highlight[];
  readonly selectedHighlightId: string | null;
  readonly noteInput: string;

  setHighlights(highlights: readonly Highlight[]): void;
  upsertHighlight(highlight: Highlight): void;
  removeHighlight(id: string): void;
  setSelectedHighlightId(id: string | null): void;
  setNoteInput(noteInput: string): void;
  reset(): void;
}

export const useHighlightStore = create<HighlightState>((set) => ({
  highlights: [],
  selectedHighlightId: null,
  noteInput: '',

  setHighlights: (highlights) => set({ highlights }),

  upsertHighlight: (highlight) =>
    set((state) => {
      const exists = state.highlights.some((h) => h.id === highlight.id);
      if (exists) {
        return {
          highlights: state.highlights.map((h) => (h.id === highlight.id ? highlight : h)),
        };
      }
      return { highlights: [...state.highlights, highlight] };
    }),

  removeHighlight: (id) =>
    set((state) => ({
      highlights: state.highlights.filter((h) => h.id !== id),
      selectedHighlightId: state.selectedHighlightId === id ? null : state.selectedHighlightId,
    })),

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
      selectedHighlightId: null,
      noteInput: '',
    }),
}));
