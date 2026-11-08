import { getViewportWidth } from '@utils/dom';
import { create } from 'zustand';

export type FontFamilyChoice = 'serif' | 'sans' | 'editorial' | 'accessible' | 'mono';

export interface FontFamilyDefinition {
  readonly id: FontFamilyChoice;
  readonly label: string;
  readonly cssFontFamily: string;
}

export const FONT_FAMILY_DEFINITIONS: Record<FontFamilyChoice, FontFamilyDefinition> = {
  serif: {
    id: 'serif',
    label: 'Serif',
    cssFontFamily:
      "Charter, 'Iowan Old Style', 'Palatino Linotype', 'URW Palladio L', P052, 'Times New Roman', Georgia, serif",
  },
  sans: {
    id: 'sans',
    label: 'San Francisco',
    cssFontFamily:
      "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  },
  editorial: {
    id: 'editorial',
    label: 'Editorial',
    cssFontFamily:
      "Athelas, 'EB Garamond', Garamond, 'Baskerville Old Face', Baskerville, 'Hoefler Text', serif",
  },
  accessible: {
    id: 'accessible',
    label: 'Dyslexic',
    cssFontFamily: "OpenDyslexic, Lexend, 'Trebuchet MS', Verdana, -apple-system, sans-serif",
  },
  mono: {
    id: 'mono',
    label: 'Monospace',
    cssFontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
};

const STORAGE_KEY = 'scholarium_typography_settings';

export const MIN_FONT_SIZE = 12;
export const MAX_FONT_SIZE = 36;
export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 5.0;

function getDefaultFontSize(): number {
  if (getViewportWidth() < 640) {
    return 16;
  }
  return 18;
}

interface StoredTypographySettings {
  readonly fontSize?: number;
  readonly zoomLevel?: number;
  readonly fontFamily?: FontFamilyChoice;
  readonly lineSpacing?: number;
}

function loadPersistedSettings(): StoredTypographySettings {
  if (typeof localStorage === 'undefined') {
    return {};
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as StoredTypographySettings;
  } catch {
    return {};
  }
}

function persistSettings(settings: StoredTypographySettings): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    console.warn('Failed to persist typography settings:', err);
  }
}

export interface TypographyState {
  readonly fontSize: number;
  readonly zoomLevel: number;
  readonly fontFamily: FontFamilyChoice;
  readonly lineSpacing: number;
  readonly isAppearancePopoverOpen: boolean;

  setFontSize(fontSize: number): void;
  increaseFontSize(step?: number): void;
  decreaseFontSize(step?: number): void;
  setZoomLevel(zoomLevel: number): void;
  increaseZoom(step?: number): void;
  decreaseZoom(step?: number): void;
  setFontFamily(fontFamily: FontFamilyChoice): void;
  setLineSpacing(lineSpacing: number): void;
  toggleAppearancePopover(): void;
  setAppearancePopoverOpen(open: boolean): void;
  reset(): void;
}

const initialSaved = loadPersistedSettings();
const initialFontSize =
  initialSaved.fontSize &&
  initialSaved.fontSize >= MIN_FONT_SIZE &&
  initialSaved.fontSize <= MAX_FONT_SIZE
    ? initialSaved.fontSize
    : getDefaultFontSize();
const initialZoom =
  initialSaved.zoomLevel && initialSaved.zoomLevel >= MIN_ZOOM && initialSaved.zoomLevel <= MAX_ZOOM
    ? initialSaved.zoomLevel
    : 1.0;
const initialFont: FontFamilyChoice = initialSaved.fontFamily ?? 'serif';
const initialSpacing = initialSaved.lineSpacing ?? 1.85;

export const useTypographyStore = create<TypographyState>((set, get) => ({
  fontSize: initialFontSize,
  zoomLevel: initialZoom,
  fontFamily: initialFont,
  lineSpacing: initialSpacing,
  isAppearancePopoverOpen: false,

  setFontSize: (fontSize) => {
    const clamped = Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, Math.round(fontSize)));
    set({ fontSize: clamped });
    persistSettings({
      fontSize: clamped,
      zoomLevel: get().zoomLevel,
      fontFamily: get().fontFamily,
      lineSpacing: get().lineSpacing,
    });
  },

  increaseFontSize: (step = 1) => {
    get().setFontSize(get().fontSize + step);
  },

  decreaseFontSize: (step = 1) => {
    get().setFontSize(get().fontSize - step);
  },

  setZoomLevel: (zoomLevel) => {
    const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(zoomLevel.toFixed(2))));
    set({ zoomLevel: clamped });
    persistSettings({
      fontSize: get().fontSize,
      zoomLevel: clamped,
      fontFamily: get().fontFamily,
      lineSpacing: get().lineSpacing,
    });
  },

  increaseZoom: (step = 0.05) => {
    get().setZoomLevel(get().zoomLevel + step);
  },

  decreaseZoom: (step = 0.05) => {
    get().setZoomLevel(get().zoomLevel - step);
  },

  setFontFamily: (fontFamily) => {
    set({ fontFamily });
    persistSettings({
      fontSize: get().fontSize,
      zoomLevel: get().zoomLevel,
      fontFamily,
      lineSpacing: get().lineSpacing,
    });
  },

  setLineSpacing: (lineSpacing) => {
    set({ lineSpacing });
    persistSettings({
      fontSize: get().fontSize,
      zoomLevel: get().zoomLevel,
      fontFamily: get().fontFamily,
      lineSpacing,
    });
  },

  toggleAppearancePopover: () =>
    set((state) => ({ isAppearancePopoverOpen: !state.isAppearancePopoverOpen })),

  setAppearancePopoverOpen: (isAppearancePopoverOpen) => set({ isAppearancePopoverOpen }),

  reset: () => {
    const defaultSize = getDefaultFontSize();
    set({
      fontSize: defaultSize,
      zoomLevel: 1.0,
      fontFamily: 'serif',
      lineSpacing: 1.85,
      isAppearancePopoverOpen: false,
    });
    persistSettings({
      fontSize: defaultSize,
      zoomLevel: 1.0,
      fontFamily: 'serif',
      lineSpacing: 1.85,
    });
  },
}));
