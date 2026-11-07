import type { Highlight } from '@domain/Highlight';

export interface TextChunk {
  readonly text: string;
  readonly highlight?: Highlight;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Finds all character index ranges inside paragraph text matching a highlight's text.
 * Handles exact matches, multiple whitespace matches, and multiline text.
 */
export function findHighlightMatchesInParagraph(
  paragraph: string,
  hlText: string
): { start: number; end: number }[] {
  const trimmed = hlText.trim();
  if (!trimmed) return [];

  // 1. Direct exact match first (fast path)
  const exactIdx = paragraph.indexOf(trimmed);
  if (exactIdx !== -1) {
    return [{ start: exactIdx, end: exactIdx + trimmed.length }];
  }

  // 2. Flexible whitespace match (matches \n, \r, tabs and multiple spaces across paragraph text)
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];

  const pattern = tokens.map(escapeRegex).join('\\s+');
  const regex = new RegExp(pattern, 'g');
  const matches: { start: number; end: number }[] = [];

  let m: RegExpExecArray | null = regex.exec(paragraph);
  while (m !== null) {
    matches.push({ start: m.index, end: m.index + m[0].length });
    m = regex.exec(paragraph);
  }

  if (matches.length > 0) {
    return matches;
  }

  // 3. Multi-line segments (if selection spanned across paragraphs or line breaks)
  const lines = trimmed
    .split(/\r?\n+/)
    .map((l) => l.trim())
    .filter((l) => l.length >= 3);

  if (lines.length > 1) {
    for (const line of lines) {
      const lineTokens = line.split(/\s+/).filter(Boolean);
      if (lineTokens.length === 0) continue;
      const linePattern = lineTokens.map(escapeRegex).join('\\s+');
      const lineRegex = new RegExp(linePattern, 'g');
      let lm: RegExpExecArray | null = lineRegex.exec(paragraph);
      while (lm !== null) {
        matches.push({ start: lm.index, end: lm.index + lm[0].length });
        lm = lineRegex.exec(paragraph);
      }
    }
  }

  return matches;
}

/**
 * Splits paragraph text into highlighted and non-highlighted chunks.
 */
export function tokenizeTextWithHighlights(
  paragraph: string,
  highlights: readonly Highlight[]
): TextChunk[] {
  if (highlights.length === 0) {
    return [{ text: paragraph }];
  }

  interface Match {
    start: number;
    end: number;
    highlight: Highlight;
  }

  const matches: Match[] = [];
  for (const hl of highlights) {
    if (!hl.text || hl.text.trim().length === 0) continue;
    const ranges = findHighlightMatchesInParagraph(paragraph, hl.text);
    for (const r of ranges) {
      matches.push({
        start: r.start,
        end: r.end,
        highlight: hl,
      });
    }
  }

  if (matches.length === 0) {
    return [{ text: paragraph }];
  }

  matches.sort((a, b) => a.start - b.start);

  const chunks: TextChunk[] = [];
  let cursor = 0;

  for (const match of matches) {
    if (match.start < cursor) {
      continue;
    }
    if (match.start > cursor) {
      chunks.push({ text: paragraph.slice(cursor, match.start) });
    }
    chunks.push({
      text: paragraph.slice(match.start, match.end),
      highlight: match.highlight,
    });
    cursor = match.end;
  }

  if (cursor < paragraph.length) {
    chunks.push({ text: paragraph.slice(cursor) });
  }

  return chunks;
}

/**
 * Extracts unique highlights that contain user notes from a list of tokenized chunks.
 */
export function extractParagraphNotes(chunks: readonly TextChunk[]): Highlight[] {
  const notesMap = new Map<string, Highlight>();
  for (const chunk of chunks) {
    if (chunk.highlight?.note && chunk.highlight.note.trim().length > 0) {
      notesMap.set(chunk.highlight.id, chunk.highlight);
    }
  }
  return Array.from(notesMap.values());
}
