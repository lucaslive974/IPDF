import { memo } from 'react';
import {
  FONT_FAMILY_DEFINITIONS,
  type FontFamilyChoice,
  useTypographyStore,
} from '../../stores/useTypographyStore';
import { Popover } from '../ui';

export interface ReaderAppearancePopoverProps {
  readonly x: number;
  readonly y: number;
  readonly onClose: () => void;
}

const FONT_OPTIONS: readonly FontFamilyChoice[] = [
  'serif',
  'sans',
  'editorial',
  'accessible',
  'mono',
];

export const ReaderAppearancePopover = memo(function ReaderAppearancePopover({
  x,
  y,
  onClose,
}: ReaderAppearancePopoverProps) {
  const fontSize = useTypographyStore((s) => s.fontSize);
  const zoomLevel = useTypographyStore((s) => s.zoomLevel);
  const fontFamily = useTypographyStore((s) => s.fontFamily);
  const increaseFontSize = useTypographyStore((s) => s.increaseFontSize);
  const decreaseFontSize = useTypographyStore((s) => s.decreaseFontSize);
  const increaseZoom = useTypographyStore((s) => s.increaseZoom);
  const decreaseZoom = useTypographyStore((s) => s.decreaseZoom);
  const setFontFamily = useTypographyStore((s) => s.setFontFamily);
  const reset = useTypographyStore((s) => s.reset);

  return (
    <Popover x={x} y={y} width="w-72" offsetY={-20} onClose={onClose}>
      <div className="flex items-center justify-between border-b border-line-subtle pb-2">
        <span className="text-xs font-semibold text-tx-main tracking-tight">
          Typography &amp; Scale
        </span>
        <button
          type="button"
          className="text-[0.65rem] text-tx-muted hover:text-tx-main cursor-pointer transition font-medium"
          onClick={reset}
        >
          Reset Defaults
        </button>
      </div>

      {/* Font Size Row (Apple [ A - ] [ 18pt ] [ A + ]) */}
      <div className="flex flex-col gap-1.5 pt-1">
        <span className="text-[0.65rem] uppercase tracking-wider font-medium text-tx-muted">
          Font Size
        </span>
        <div className="flex items-center justify-between rounded-lg bg-surface-subtle/80 p-1 border border-line-subtle/70">
          <button
            type="button"
            className="flex-1 text-center py-1 rounded-md text-xs font-serif font-medium text-tx-secondary hover:text-tx-main hover:bg-surface transition cursor-pointer select-none active:scale-95"
            onClick={() => decreaseFontSize(1)}
            title="Decrease Font Size"
            aria-label="Decrease Font Size"
          >
            A &minus;
          </button>
          <span className="w-16 text-center font-mono text-xs font-semibold text-tx-main">
            {fontSize} pt
          </span>
          <button
            type="button"
            className="flex-1 text-center py-1 rounded-md text-xs font-serif font-bold text-tx-secondary hover:text-tx-main hover:bg-surface transition cursor-pointer select-none active:scale-95"
            onClick={() => increaseFontSize(1)}
            title="Increase Font Size"
            aria-label="Increase Font Size"
          >
            A &#43;
          </button>
        </div>
      </div>

      {/* Zoom / Scale Row (Ctrl + Scroll / Touch Pinch) */}
      <div className="flex flex-col gap-1.5 pt-1">
        <div className="flex items-center justify-between">
          <span className="text-[0.65rem] uppercase tracking-wider font-medium text-tx-muted">
            Zoom Scale
          </span>
          <span className="text-[0.62rem] text-tx-muted font-mono">Ctrl+Scroll / Pinch</span>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-surface-subtle/80 p-1 border border-line-subtle/70">
          <button
            type="button"
            className="flex-1 text-center py-1 rounded-md text-xs font-medium text-tx-secondary hover:text-tx-main hover:bg-surface transition cursor-pointer select-none active:scale-95"
            onClick={() => decreaseZoom(0.1)}
            title="Zoom Out"
            aria-label="Zoom Out"
          >
            &minus;
          </button>
          <span className="w-16 text-center font-mono text-xs font-semibold text-tx-main">
            {Math.round(zoomLevel * 100)}%
          </span>
          <button
            type="button"
            className="flex-1 text-center py-1 rounded-md text-xs font-medium text-tx-secondary hover:text-tx-main hover:bg-surface transition cursor-pointer select-none active:scale-95"
            onClick={() => increaseZoom(0.1)}
            title="Zoom In"
            aria-label="Zoom In"
          >
            &#43;
          </button>
        </div>
      </div>

      {/* Font Family Selection */}
      <div className="flex flex-col gap-1.5 pt-1 border-t border-line-subtle/60">
        <span className="text-[0.65rem] uppercase tracking-wider font-medium text-tx-muted">
          Typeface
        </span>
        <div className="flex flex-col gap-1">
          {FONT_OPTIONS.map((opt) => {
            const def = FONT_FAMILY_DEFINITIONS[opt];
            const isSelected = fontFamily === opt;
            return (
              <button
                key={opt}
                type="button"
                className={`flex items-center justify-between px-3 py-1.5 rounded-md text-xs transition cursor-pointer text-left ${
                  isSelected
                    ? 'bg-surface text-tx-main shadow-2xs font-semibold border border-line-subtle/80'
                    : 'text-tx-secondary hover:bg-surface-subtle hover:text-tx-main'
                }`}
                style={{ fontFamily: def.cssFontFamily }}
                onClick={() => setFontFamily(opt)}
              >
                <span>{def.label}</span>
                {isSelected && <span className="font-mono text-xs text-tx-main">&bull;</span>}
              </button>
            );
          })}
        </div>
      </div>
    </Popover>
  );
});
