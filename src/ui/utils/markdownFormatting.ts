import type { TextFormatStyle } from '../../core/domain/types';

export function formatMarkdownStyle(selected: string, style: TextFormatStyle): string {
  switch (style.kind) {
    case 'bold':
      return `**${selected}**`;
    case 'italic':
      return `*${selected}*`;
    case 'underline':
      return `<u>${selected}</u>`;
    case 'strikethrough':
      return `~~${selected}~~`;
    case 'textColor':
      return `<span style="color:${style.colorHex}">${selected}</span>`;
    case 'backgroundColor':
      return `<mark style="background-color:${style.colorHex}">${selected}</mark>`;
    case 'heading':
      return `${'#'.repeat(style.level)} ${selected}`;
    case 'bulletList':
      return selected
        .split('\n')
        .map((line) => `- ${line}`)
        .join('\n');
    case 'orderedList':
      return selected
        .split('\n')
        .map((line, index) => `${index + 1}. ${line}`)
        .join('\n');
    case 'blockquote':
      return selected
        .split('\n')
        .map((line) => `> ${line}`)
        .join('\n');
  }
}

export function formatMarkdownSelection(
  content: string,
  range: { start: number; end: number },
  style: TextFormatStyle
): string {
  const safeStart = Math.max(0, Math.min(range.start, content.length));
  const safeEnd = Math.max(safeStart, Math.min(range.end, content.length));
  const before = content.slice(0, safeStart);
  const selected = content.slice(safeStart, safeEnd);
  const after = content.slice(safeEnd);

  const formatted = formatMarkdownStyle(selected, style);
  return `${before}${formatted}${after}`;
}
