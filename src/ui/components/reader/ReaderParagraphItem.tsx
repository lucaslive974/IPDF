import type { Highlight } from '@domain/Highlight';
import { extractParagraphNotes, tokenizeTextWithHighlights } from '@utils/readerTokenizer';
import { memo, useMemo } from 'react';
import { HighlightedParagraph } from './HighlightedParagraph';
import { ParagraphMarginNotes } from './ParagraphMarginNotes';

export interface ReaderParagraphItemProps {
  readonly pageNumber: number;
  readonly paragraph: string;
  readonly highlights: readonly Highlight[];
  readonly onHighlightClick: (highlight: Highlight, coords: { x: number; y: number }) => void;
  readonly onHighlightContextMenu: (e: React.MouseEvent, text: string, pageNumber: number) => void;
}

export const ReaderParagraphItem = memo(function ReaderParagraphItem({
  pageNumber,
  paragraph,
  highlights,
  onHighlightClick,
  onHighlightContextMenu,
}: ReaderParagraphItemProps) {
  const chunks = useMemo(
    () => tokenizeTextWithHighlights(paragraph, highlights),
    [paragraph, highlights]
  );

  const paragraphNotes = useMemo(() => extractParagraphNotes(chunks), [chunks]);

  return (
    <div className="relative group">
      <HighlightedParagraph
        chunks={chunks}
        pageNumber={pageNumber}
        onHighlightClick={onHighlightClick}
        onHighlightContextMenu={onHighlightContextMenu}
      />
      <ParagraphMarginNotes notes={paragraphNotes} onNoteClick={onHighlightClick} />
    </div>
  );
});
