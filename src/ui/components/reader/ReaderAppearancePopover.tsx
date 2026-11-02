import { useTypographyStore } from '@stores/useTypographyStore';
import { Popover } from '@ui';
import { memo } from 'react';
import { ReaderFontSizeControl } from './ReaderFontSizeControl';
import { ReaderTypefaceSelector } from './ReaderTypefaceSelector';
import { ReaderZoomControl } from './ReaderZoomControl';

export interface ReaderAppearancePopoverProps {
  readonly x: number;
  readonly y: number;
  readonly onClose: () => void;
}

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

      <ReaderFontSizeControl
        fontSize={fontSize}
        onDecrease={() => decreaseFontSize(1)}
        onIncrease={() => increaseFontSize(1)}
      />

      <ReaderZoomControl
        zoomLevel={zoomLevel}
        onDecrease={() => decreaseZoom(0.1)}
        onIncrease={() => increaseZoom(0.1)}
      />

      <ReaderTypefaceSelector fontFamily={fontFamily} onSelectFontFamily={setFontFamily} />
    </Popover>
  );
});
