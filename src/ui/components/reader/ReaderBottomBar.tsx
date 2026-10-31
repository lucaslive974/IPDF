import { memo, useEffect, useRef, useState } from 'react';
import { useReader } from '../../hooks/useReader';
import { useReaderUI } from '../../hooks/useReaderUI';

export interface ReaderBottomBarProps {
  readonly onScrollToPage: (targetPage: number) => void;
}

export const ReaderBottomBar = memo(function ReaderBottomBar({
  onScrollToPage,
}: ReaderBottomBarProps) {
  const reader = useReader();
  const { isChromeVisible } = useReaderUI();

  const [pageInputValue, setPageInputValue] = useState<string>(String(reader.currentPage));
  const isPageInputFocusedRef = useRef(false);

  useEffect(() => {
    if (!isPageInputFocusedRef.current) {
      setPageInputValue(String(reader.currentPage));
    }
  }, [reader.currentPage]);

  return (
    <>
      <footer
        className={`fixed bottom-4 inset-x-0 z-40 flex justify-center px-4 transition-all duration-300 ease-in-out ${
          isChromeVisible
            ? 'translate-y-0 opacity-100'
            : 'translate-y-12 opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-2 rounded-full border border-line-subtle bg-surface/95 px-4 py-1.5 shadow-xl backdrop-blur-md text-xs font-semibold">
          <span className="text-tx-muted">Page</span>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={pageInputValue}
            onFocus={() => {
              isPageInputFocusedRef.current = true;
            }}
            onChange={(e) => {
              const cleanDigits = e.target.value.replace(/\D/g, '');
              setPageInputValue(cleanDigits);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const target = Number.parseInt(pageInputValue, 10);
                if (!Number.isNaN(target) && target >= 1 && target <= reader.totalPages) {
                  onScrollToPage(target);
                  (e.target as HTMLInputElement).blur();
                }
              }
            }}
            onBlur={() => {
              isPageInputFocusedRef.current = false;
              const target = Number.parseInt(pageInputValue, 10);
              if (!Number.isNaN(target) && target >= 1 && target <= reader.totalPages) {
                if (target !== reader.currentPage) {
                  onScrollToPage(target);
                }
              } else {
                setPageInputValue(String(reader.currentPage));
              }
            }}
            className="w-16 rounded-md border border-line-subtle bg-surface-subtle px-2 py-0.5 text-center font-mono text-xs font-bold text-tx-main focus:border-brand outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            aria-label="Direct page number jump"
          />
          <span className="text-tx-muted font-mono">of {reader.totalPages}</span>
        </div>
      </footer>

      {!isChromeVisible && (
        <div className="fixed bottom-3 right-4 z-20 text-[0.65rem] font-mono text-tx-faint/60 select-none pointer-events-none transition-opacity duration-300">
          {reader.currentPage} / {reader.totalPages}
        </div>
      )}
    </>
  );
});
