import { type RefObject, useCallback, useEffect } from 'react';
import { getExpandedWordSelection } from '../utils/domSelection';
import { useReaderUI } from './useReaderUI';

export function resolveContextMenuPayload(
  rawText: string,
  targetPageNumber: number | null,
  currentPage: number
): { readonly text: string; readonly pageNumber: number } | null {
  const text = rawText.trim();
  if (text.length === 0) return null;

  return {
    text,
    pageNumber: targetPageNumber && targetPageNumber > 0 ? targetPageNumber : currentPage,
  };
}

export interface UseReaderStreamContextMenuOptions {
  readonly contentAreaRef: RefObject<HTMLElement | null>;
  readonly currentPage: number;
}

export interface UseReaderStreamContextMenuReturn {
  readonly handleHighlightContextMenu: (
    e: React.MouseEvent,
    text: string,
    pageNumber: number
  ) => void;
}

/**
 * Manages right-click context menu events for reader stream selections and existing highlights.
 */
export function useReaderStreamContextMenu({
  contentAreaRef,
  currentPage,
}: UseReaderStreamContextMenuOptions): UseReaderStreamContextMenuReturn {
  const { setContextMenu } = useReaderUI();

  // Handle right-click text selection within the stream container
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        return;
      }
      const expandedText = getExpandedWordSelection(selection);
      const target = e.target as HTMLElement | null;
      const article = target?.closest('article[data-page-number]');
      const parsedPage = article ? Number(article.getAttribute('data-page-number')) : null;

      const payload = resolveContextMenuPayload(expandedText, parsedPage, currentPage);
      if (!payload) return;

      e.preventDefault();
      setContextMenu({
        text: payload.text,
        x: e.clientX,
        y: e.clientY,
        pageNumber: payload.pageNumber,
      });
    };

    const container = contentAreaRef.current;
    if (container) {
      container.addEventListener('contextmenu', handleContextMenu);
    }
    return () => {
      if (container) {
        container.removeEventListener('contextmenu', handleContextMenu);
      }
    };
  }, [contentAreaRef, currentPage, setContextMenu]);

  const handleHighlightContextMenu = useCallback(
    (e: React.MouseEvent, text: string, pageNumber: number) => {
      setContextMenu({
        text,
        x: e.clientX,
        y: e.clientY,
        pageNumber,
      });
    },
    [setContextMenu]
  );

  return {
    handleHighlightContextMenu,
  };
}
