import { memo } from 'react';

export interface ReaderFontSizeControlProps {
  readonly fontSize: number;
  readonly onDecrease: () => void;
  readonly onIncrease: () => void;
}

export const ReaderFontSizeControl = memo(function ReaderFontSizeControl({
  fontSize,
  onDecrease,
  onIncrease,
}: ReaderFontSizeControlProps) {
  return (
    <div className="flex flex-col gap-1.5 pt-1">
      <span className="text-[0.65rem] uppercase tracking-wider font-medium text-tx-muted">
        Font Size
      </span>
      <div className="flex items-center justify-between rounded-lg bg-surface-subtle/80 p-1 border border-line-subtle/70">
        <button
          type="button"
          className="flex-1 text-center py-1 rounded-md text-xs font-serif font-medium text-tx-secondary hover:text-tx-main hover:bg-surface transition cursor-pointer select-none active:scale-95"
          onClick={onDecrease}
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
          onClick={onIncrease}
          aria-label="Increase Font Size"
        >
          A &#43;
        </button>
      </div>
    </div>
  );
});
