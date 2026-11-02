import type { Highlight } from '@domain/Highlight';
import { getExpandedWordSelection } from '@utils/domSelection';
import {
  type TextChunk,
  findHighlightMatchesInParagraph,
  tokenizeTextWithHighlights,
} from '@utils/readerTokenizer';
import { memo } from 'react';
import { ReaderParagraphItem } from './ReaderParagraphItem';

export {
  getExpandedWordSelection,
  findHighlightMatchesInParagraph,
  tokenizeTextWithHighlights,
  type TextChunk,
};

export interface ReaderPageParagraphsProps {
  readonly pageNumber: number;
  readonly paragraphs: readonly string[];
  readonly highlights: readonly Highlight[];
  readonly cssFontFamily: string;
  readonly fontSize: number;
  readonly lineSpacing: number;
  readonly onHighlightClick: (highlight: Highlight, coords: { x: number; y: number }) => void;
  readonly onHighlightContextMenu: (e: React.MouseEvent, text: string, pageNumber: number) => void;
}

export const ReaderPageParagraphs = memo(function ReaderPageParagraphs({
  pageNumber,
  paragraphs,
  highlights,
  cssFontFamily,
  fontSize,
  lineSpacing,
  onHighlightClick,
  onHighlightContextMenu,
}: ReaderPageParagraphsProps) {
  return (
    <div
      className="space-y-6 text-tx-main tracking-normal"
      style={{
        fontFamily: cssFontFamily,
        fontSize: `${fontSize}px`,
        lineHeight: lineSpacing,
      }}
    >
      {paragraphs.map((paragraph, pIdx) => (
        <ReaderParagraphItem
          key={`p-wrap-${pageNumber}-${pIdx + 1}`}
          pageNumber={pageNumber}
          paragraph={paragraph}
          highlights={highlights}
          onHighlightClick={onHighlightClick}
          onHighlightContextMenu={onHighlightContextMenu}
        />
      ))}
    </div>
  );
});
