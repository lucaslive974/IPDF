import { useReaderUI } from '@hooks/useReaderUI';
import { useNavigation } from '@providers/NavigationContext';
import { useReaderStore } from '@stores/useReaderStore';
import { useTypographyStore } from '@stores/useTypographyStore';
import { ArrowLeftIcon, Button, IconButton, SettingsIcon } from '@ui';
import { memo } from 'react';
import { isValidAuthor } from '../library/BookCover';

export interface ReaderHeaderProps {
  readonly onClose: () => void;
}

export const ReaderHeader = memo(function ReaderHeader({ onClose }: ReaderHeaderProps) {
  const document = useReaderStore((s) => s.document);
  const chapterTitle = useReaderStore((s) => s.chapterTitle);
  const currentPage = useReaderStore((s) => s.currentPage);
  const totalPages = useReaderStore((s) => s.totalPages);
  const navigation = useNavigation();
  const { isChromeVisible } = useReaderUI();
  const toggleAppearancePopover = useTypographyStore((s) => s.toggleAppearancePopover);

  return (
    <header
      className={`fixed top-0 inset-x-0 z-40 flex items-center justify-between border-b border-line-subtle/70 bg-canvas/85 px-6 py-3 backdrop-blur-md transition-all duration-300 ease-in-out ${
        isChromeVisible
          ? 'translate-y-0 opacity-100'
          : '-translate-y-full opacity-0 pointer-events-none'
      }`}
    >
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          iconLeft={<ArrowLeftIcon className="h-3.5 w-3.5" />}
          onClick={onClose}
        >
          Library
        </Button>
        <div className="hidden sm:flex flex-col">
          <span className="text-xs font-medium text-tx-main">
            {isValidAuthor(document.bookAuthor)
              ? `${document.bookAuthor} \u2014 ${document.bookTitle}`
              : document.bookTitle}
          </span>
          <span className="text-[0.68rem] text-tx-muted">
            {chapterTitle || document.chapterTitle}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 rounded-full border border-line-subtle/70 bg-surface/60 px-3 py-0.5 text-xs text-tx-secondary">
          <span className="font-mono text-[0.68rem] text-tx-muted">
            Page {currentPage} of {totalPages}
          </span>
        </div>
        <IconButton
          variant="ghost"
          size="xs"
          label="Appearance & Typography"
          onClick={toggleAppearancePopover}
        >
          <span className="font-serif font-semibold text-xs tracking-tighter">AA</span>
        </IconButton>
        <IconButton variant="ghost" size="xs" label="Settings" onClick={navigation.openSettings}>
          <SettingsIcon className="h-4 w-4" />
        </IconButton>
      </div>
    </header>
  );
});
