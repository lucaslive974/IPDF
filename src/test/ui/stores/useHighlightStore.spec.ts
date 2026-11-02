import { Highlight } from '@domain/Highlight';
import { useHighlightStore } from '@stores/useHighlightStore';
import { beforeEach, describe, expect, it } from 'vitest';

describe('useHighlightStore', () => {
  beforeEach(() => {
    useHighlightStore.getState().reset();
  });

  const createTestHighlight = (id: string, text: string, note = ''): Highlight =>
    new Highlight(
      id,
      'book-hash',
      text,
      '#FFEB3B',
      { format: 'epub', pageNumber: 1 },
      note,
      new Date('2026-03-01T10:00:00.000Z')
    );

  it('initializes with empty highlights and no selection', () => {
    const state = useHighlightStore.getState();
    expect(state.highlights).toEqual([]);
    expect(state.selectedHighlightId).toBeNull();
    expect(state.noteInput).toBe('');
  });

  it('adds and updates highlights with upsertHighlight', () => {
    const hl1 = createTestHighlight('hl-1', 'Text 1', 'Note 1');
    useHighlightStore.getState().upsertHighlight(hl1);

    expect(useHighlightStore.getState().highlights).toHaveLength(1);

    const updatedHl1 = createTestHighlight('hl-1', 'Text 1', 'Updated Note');
    useHighlightStore.getState().upsertHighlight(updatedHl1);

    expect(useHighlightStore.getState().highlights).toHaveLength(1);
    expect(useHighlightStore.getState().highlights[0]?.note).toBe('Updated Note');
  });

  it('removes highlight and clears selection if active', () => {
    const hl1 = createTestHighlight('hl-1', 'Text 1', 'Note 1');
    useHighlightStore.getState().upsertHighlight(hl1);
    useHighlightStore.getState().setSelectedHighlightId('hl-1');

    expect(useHighlightStore.getState().selectedHighlightId).toBe('hl-1');
    expect(useHighlightStore.getState().noteInput).toBe('Note 1');

    useHighlightStore.getState().removeHighlight('hl-1');
    expect(useHighlightStore.getState().highlights).toHaveLength(0);
    expect(useHighlightStore.getState().selectedHighlightId).toBeNull();
  });
});
