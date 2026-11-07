/**
 * Expands a browser selection to word boundaries so highlights never divide words.
 */
export function getExpandedWordSelection(selection: Selection | null): string {
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return '';
  }

  const raw = selection.toString();
  if (!raw || raw.trim().length === 0) return '';

  try {
    const range = selection.getRangeAt(0);
    const expandedRange = range.cloneRange();

    // Expand start to word boundary if inside a text node
    if (expandedRange.startContainer.nodeType === Node.TEXT_NODE) {
      const text = expandedRange.startContainer.textContent || '';
      let start = expandedRange.startOffset;
      while (start > 0 && /[\w\u00C0-\u024F]/.test(text[start - 1] || '')) {
        start--;
      }
      expandedRange.setStart(expandedRange.startContainer, start);
    }

    // Expand end to word boundary if inside a text node
    if (expandedRange.endContainer.nodeType === Node.TEXT_NODE) {
      const text = expandedRange.endContainer.textContent || '';
      let end = expandedRange.endOffset;
      while (end < text.length && /[\w\u00C0-\u024F]/.test(text[end] || '')) {
        end++;
      }
      expandedRange.setEnd(expandedRange.endContainer, end);
    }

    const expandedText = expandedRange.toString().trim();
    if (expandedText.length > 0) {
      return expandedText;
    }
  } catch {
    // Fallback to raw selection if DOM range manipulation is unsupported
  }

  return raw.trim();
}
