import { Highlight } from '@domain/Highlight';
import { useReaderUIStore } from '@stores/useReaderUIStore';
import { beforeEach, describe, expect, it } from 'vitest';

describe('useReaderUIStore', () => {
  beforeEach(() => {
    useReaderUIStore.getState().reset();
  });

  const createTestHighlight = (id: string): Highlight =>
    new Highlight(
      id,
      'book-hash',
      'Text',
      '#FFEB3B',
      { format: 'epub', pageNumber: 1 },
      'Note',
      new Date('2026-03-01T10:00:00.000Z')
    );

  it('toggles chrome visibility', () => {
    expect(useReaderUIStore.getState().isChromeVisible).toBe(false);
    useReaderUIStore.getState().toggleChrome();
    expect(useReaderUIStore.getState().isChromeVisible).toBe(true);
    useReaderUIStore.getState().toggleChrome();
    expect(useReaderUIStore.getState().isChromeVisible).toBe(false);
  });

  it('opens and closes highlight popover', () => {
    const hl = createTestHighlight('hl-popover');
    useReaderUIStore.getState().openHighlightPopover(hl, { x: 100, y: 200 });

    const state = useReaderUIStore.getState();
    expect(state.activeHighlightPopover?.highlight.id).toBe('hl-popover');
    expect(state.activeHighlightPopover?.x).toBe(100);
    expect(state.activeHighlightPopover?.y).toBe(200);

    useReaderUIStore.getState().closeHighlightPopover();
    expect(useReaderUIStore.getState().activeHighlightPopover).toBeNull();
  });

  it('closes all overlays with closeAllOverlays', () => {
    const hl = createTestHighlight('hl-modal');
    useReaderUIStore.getState().setSelectionPopover({ text: 'Selected', x: 50, y: 50 });
    useReaderUIStore.getState().openHighlightPopover(hl, { x: 100, y: 100 });
    useReaderUIStore.getState().setContextMenu({ x: 10, y: 10, text: 'Context', pageNumber: 1 });
    useReaderUIStore.getState().setActiveNoteDialog({ text: 'Note', pageNumber: 1 });

    useReaderUIStore.getState().closeAllOverlays();

    const state = useReaderUIStore.getState();
    expect(state.selectionPopover).toBeNull();
    expect(state.activeHighlightPopover).toBeNull();
    expect(state.contextMenu).toBeNull();
    expect(state.activeNoteDialog).toBeNull();
  });
});
