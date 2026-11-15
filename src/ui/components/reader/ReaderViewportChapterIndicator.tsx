import { memo } from 'react';

export interface ReaderViewportChapterIndicatorProps {
  readonly chapterTitle?: string;
  readonly isVisible: boolean;
}

export const ReaderViewportChapterIndicator = memo(function ReaderViewportChapterIndicator({
  chapterTitle,
  isVisible,
}: ReaderViewportChapterIndicatorProps) {
  if (!chapterTitle || !isVisible) {
    return null;
  }

  return (
    <aside
      data-testid="reader-viewport-chapter-indicator"
      className="fixed safe-top-3 safe-right-4 reader-ambient-hud max-w-[40vw] truncate text-[0.7rem] font-medium tracking-wide text-tx-muted/60 text-right"
      title={chapterTitle}
    >
      {chapterTitle}
    </aside>
  );
});
