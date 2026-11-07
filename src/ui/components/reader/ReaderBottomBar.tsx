import { useReaderUI } from '@hooks/useReaderUI';
import { useReaderStore } from '@stores/useReaderStore';
import { memo, useEffect, useRef, useState } from 'react';

export interface ReaderBottomBarProps {
  readonly onScrollToPage: (targetPage: number) => void;
}

export const ReaderBottomBar = memo(function ReaderBottomBar({
  onScrollToPage,
}: ReaderBottomBarProps) {
  const currentPage = useReaderStore((s) => s.currentPage);
  const totalPages = useReaderStore((s) => s.totalPages);
  const { isChromeVisible } = useReaderUI();

  const [pageInputValue, setPageInputValue] = useState<string>(String(currentPage));
  const isPageInputFocusedRef = useRef(false);

  useEffect(() => {
    if (!isPageInputFocusedRef.current) {
      setPageInputValue(String(currentPage));
    }
  }, [currentPage]);

  return (
    <>
      <footer
        className={`fixed bottom-4 inset-x-0 z-40 flex justify-center px-4 transition-all duration-300 ease-in-out ${
          isChromeVisible
            ? 'translate-y-0 opacity-100'
            : 'translate-y-12 opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-2 rounded-full border border-line-subtle/70 bg-surface/85 px-3.5 py-1.5 shadow-md backdrop-blur-md text-xs font-medium">
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
                if (!Number.isNaN(target) && target >= 1 && target <= totalPages) {
                  onScrollToPage(target);
                  (e.target as HTMLInputElement).blur();
                }
              }
            }}
            onBlur={() => {
              isPageInputFocusedRef.current = false;
              const target = Number.parseInt(pageInputValue, 10);
              if (!Number.isNaN(target) && target >= 1 && target <= totalPages) {
                if (target !== currentPage) {
                  onScrollToPage(target);
                }
              } else {
                setPageInputValue(String(currentPage));
              }
            }}
            className="w-14 rounded-md border border-line-subtle/80 bg-surface-subtle/80 px-2 py-0.5 text-center font-mono text-xs font-medium text-tx-main focus:border-line-strong outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            aria-label="Direct page number jump"
          />
          <span className="text-tx-muted font-mono text-[0.7rem]">of {totalPages}</span>
        </div>
      </footer>

      {!isChromeVisible && (
        <div className="fixed bottom-3 right-4 z-20 text-[0.65rem] font-mono text-tx-faint/60 select-none pointer-events-none transition-opacity duration-300">
          {currentPage} / {totalPages}
        </div>
      )}
    </>
  );
});
