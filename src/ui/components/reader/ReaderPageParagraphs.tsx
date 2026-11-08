import type { Highlight } from '@domain/Highlight';
import { useReaderStore } from '@stores/useReaderStore';
import { hasIntersectionObserver } from '@utils/dom';
import { getExpandedWordSelection } from '@utils/domSelection';
import {
  type TextChunk,
  findHighlightMatchesInParagraph,
  tokenizeTextWithHighlights,
} from '@utils/readerTokenizer';
import { memo, useEffect, useRef, useState } from 'react';
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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isNearViewport, setIsNearViewport] = useState<boolean>(() => {
    const targetPage = useReaderStore.getState().currentPage;
    return !hasIntersectionObserver() || Math.abs(pageNumber - targetPage) <= 1;
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !hasIntersectionObserver()) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          setIsNearViewport(entry.isIntersecting);
        }
      },
      { rootMargin: '800px 0px' }
    );

    observer.observe(container);
    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="space-y-6 text-tx-main tracking-normal"
      style={{
        fontFamily: cssFontFamily,
        fontSize: `${fontSize}px`,
        lineHeight: lineSpacing,
      }}
    >
      {isNearViewport &&
        paragraphs.map((paragraph, pIdx) => (
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
