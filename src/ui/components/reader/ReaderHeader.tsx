import { memo } from 'react';
import { useNavigation } from '../../hooks/useNavigation';
import { useReader } from '../../hooks/useReader';
import { useReaderUI } from '../../hooks/useReaderUI';
import { Button, IconButton } from '../ui';

export interface ReaderHeaderProps {
  readonly onClose: () => void;
}

export const ReaderHeader = memo(function ReaderHeader({ onClose }: ReaderHeaderProps) {
  const reader = useReader();
  const navigation = useNavigation();
  const { isChromeVisible } = useReaderUI();

  return (
    <header
      className={`fixed top-0 inset-x-0 z-40 flex items-center justify-between border-b border-line-subtle bg-surface/90 px-6 py-3 backdrop-blur-md transition-all duration-300 ease-in-out ${
        isChromeVisible
          ? 'translate-y-0 opacity-100'
          : '-translate-y-full opacity-0 pointer-events-none'
      }`}
    >
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" iconLeft="←" onClick={onClose}>
          Library
        </Button>
        <div className="hidden sm:flex flex-col">
          <span className="text-xs font-semibold text-tx-main">
            {reader.document.bookAuthor} &mdash; {reader.document.bookTitle}
          </span>
          <span className="text-[0.7rem] text-tx-muted">
            {reader.chapterTitle || reader.document.chapterTitle}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-full border border-line-subtle bg-surface px-3 py-1 text-xs text-tx-secondary">
          <span className="font-mono font-bold text-tx-main">
            Page {reader.currentPage} of {reader.totalPages}
          </span>
        </div>
        <IconButton variant="outline" size="sm" label="Settings" onClick={navigation.openSettings}>
          ⚙️
        </IconButton>
      </div>
    </header>
  );
});
