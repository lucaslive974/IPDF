import { memo } from 'react';

export interface ReaderZoomControlProps {
  readonly zoomLevel: number;
  readonly onDecrease: () => void;
  readonly onIncrease: () => void;
}

export const ReaderZoomControl = memo(function ReaderZoomControl({
  zoomLevel,
  onDecrease,
  onIncrease,
}: ReaderZoomControlProps) {
  return (
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
          onClick={onDecrease}
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
          onClick={onIncrease}
          title="Zoom In"
          aria-label="Zoom In"
        >
          &#43;
        </button>
      </div>
    </div>
  );
});
