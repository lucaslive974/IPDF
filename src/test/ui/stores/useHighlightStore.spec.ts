import { Highlight } from '@domain/Highlight';
import { useHighlightStore } from '@stores/useHighlightStore';
import { beforeEach, describe, expect, it } from 'vitest';

describe('useHighlightStore', () => {
  beforeEach(() => {
    useHighlightStore.getState().reset();
  });

  const createTestHighlight = (id: string, text: string, note = '', pageNumber = 1): Highlight =>
    new Highlight(
      id,
      'book-hash',
      text,
      '#FFEB3B',
      { format: 'epub', pageNumber },
      note,
      new Date('2026-03-01T10:00:00.000Z')
    );

  it('initializes with empty highlights and no selection', () => {
    const state = useHighlightStore.getState();
    expect(state.highlights).toEqual([]);
    expect(state.highlightsByPage.size).toBe(0);
    expect(state.selectedHighlightId).toBeNull();
    expect(state.noteInput).toBe('');
  });

  it('indexes highlights by page on setHighlights and preserves untouched page refs on upsert', () => {
    const hl1 = createTestHighlight('hl-1', 'Page 1', '', 1);
    const hl2 = createTestHighlight('hl-2', 'Page 2', '', 2);
    useHighlightStore.getState().setHighlights([hl1, hl2]);

    const initialPage1Ref = useHighlightStore.getState().highlightsByPage.get(1);
    const initialPage2Ref = useHighlightStore.getState().highlightsByPage.get(2);
    expect(initialPage1Ref).toEqual([hl1]);
    expect(initialPage2Ref).toEqual([hl2]);

    const hl3 = createTestHighlight('hl-3', 'Page 2 second', '', 2);
    useHighlightStore.getState().upsertHighlight(hl3);

    expect(useHighlightStore.getState().highlightsByPage.get(1)).toBe(initialPage1Ref);
    expect(useHighlightStore.getState().highlightsByPage.get(2)).toEqual([hl2, hl3]);
  });

  it('moves highlight across pages in highlightsByPage when pageNumber changes on upsert', () => {
    const hl1 = createTestHighlight('hl-1', 'Text', '', 1);
    useHighlightStore.getState().setHighlights([hl1]);

    const moved = createTestHighlight('hl-1', 'Text', 'Moved', 3);
    useHighlightStore.getState().upsertHighlight(moved);

    expect(useHighlightStore.getState().highlightsByPage.get(1)).toBeUndefined();
    expect(useHighlightStore.getState().highlightsByPage.get(3)).toEqual([moved]);
  });

  it('removes highlight from highlightsByPage while preserving untouched page refs', () => {
    const hl1 = createTestHighlight('hl-1', 'Page 1', '', 1);
    const hl2 = createTestHighlight('hl-2', 'Page 2', '', 2);
    useHighlightStore.getState().setHighlights([hl1, hl2]);

    const page2Ref = useHighlightStore.getState().highlightsByPage.get(2);
    useHighlightStore.getState().removeHighlight('hl-1');

    expect(useHighlightStore.getState().highlightsByPage.get(1)).toBeUndefined();
    expect(useHighlightStore.getState().highlightsByPage.get(2)).toBe(page2Ref);
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
