import {
  MAX_FONT_SIZE,
  MAX_ZOOM,
  MIN_FONT_SIZE,
  MIN_ZOOM,
  useTypographyStore,
} from '@stores/useTypographyStore';
import { beforeEach, describe, expect, it } from 'vitest';

describe('useTypographyStore', () => {
  beforeEach(() => {
    useTypographyStore.getState().reset();
  });

  it('initializes with valid default typography settings', () => {
    const state = useTypographyStore.getState();
    expect(state.fontSize).toBeGreaterThanOrEqual(MIN_FONT_SIZE);
    expect(state.fontSize).toBeLessThanOrEqual(MAX_FONT_SIZE);
    expect(state.zoomLevel).toBe(1.0);
    expect(state.fontFamily).toBe('serif');
    expect(state.isAppearancePopoverOpen).toBe(false);
  });

  it('clamps font size to minimum and maximum bounds', () => {
    useTypographyStore.getState().setFontSize(MIN_FONT_SIZE - 5);
    expect(useTypographyStore.getState().fontSize).toBe(MIN_FONT_SIZE);

    useTypographyStore.getState().setFontSize(MAX_FONT_SIZE + 20);
    expect(useTypographyStore.getState().fontSize).toBe(MAX_FONT_SIZE);
  });

  it('increases and decreases font size', () => {
    useTypographyStore.getState().setFontSize(18);
    useTypographyStore.getState().increaseFontSize(2);
    expect(useTypographyStore.getState().fontSize).toBe(20);

    useTypographyStore.getState().decreaseFontSize(3);
    expect(useTypographyStore.getState().fontSize).toBe(17);
  });

  it('clamps zoom level to minimum and maximum bounds', () => {
    useTypographyStore.getState().setZoomLevel(MIN_ZOOM - 0.5);
    expect(useTypographyStore.getState().zoomLevel).toBe(MIN_ZOOM);

    useTypographyStore.getState().setZoomLevel(MAX_ZOOM + 1.0);
    expect(useTypographyStore.getState().zoomLevel).toBe(MAX_ZOOM);
  });

  it('increases and decreases zoom level', () => {
    useTypographyStore.getState().setZoomLevel(1.0);
    useTypographyStore.getState().increaseZoom(0.1);
    expect(useTypographyStore.getState().zoomLevel).toBe(1.1);

    useTypographyStore.getState().decreaseZoom(0.2);
    expect(useTypographyStore.getState().zoomLevel).toBe(0.9);
  });

  it('switches font family', () => {
    useTypographyStore.getState().setFontFamily('sans');
    expect(useTypographyStore.getState().fontFamily).toBe('sans');

    useTypographyStore.getState().setFontFamily('editorial');
    expect(useTypographyStore.getState().fontFamily).toBe('editorial');

    useTypographyStore.getState().setFontFamily('accessible');
    expect(useTypographyStore.getState().fontFamily).toBe('accessible');

    useTypographyStore.getState().setFontFamily('mono');
    expect(useTypographyStore.getState().fontFamily).toBe('mono');
  });

  it('toggles appearance popover', () => {
    expect(useTypographyStore.getState().isAppearancePopoverOpen).toBe(false);
    useTypographyStore.getState().toggleAppearancePopover();
    expect(useTypographyStore.getState().isAppearancePopoverOpen).toBe(true);
    useTypographyStore.getState().toggleAppearancePopover();
    expect(useTypographyStore.getState().isAppearancePopoverOpen).toBe(false);
  });

  it('resets to defaults', () => {
    useTypographyStore.getState().setFontSize(30);
    useTypographyStore.getState().setZoomLevel(2.0);
    useTypographyStore.getState().setFontFamily('mono');
    useTypographyStore.getState().setAppearancePopoverOpen(true);

    useTypographyStore.getState().reset();

    const state = useTypographyStore.getState();
    expect(state.zoomLevel).toBe(1.0);
    expect(state.fontFamily).toBe('serif');
    expect(state.isAppearancePopoverOpen).toBe(false);
  });
});
