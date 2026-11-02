import { Highlight } from '@domain/Highlight';
import { type AnnotationFormatterMap, createAssistedTextAnnotation } from '@domain/RichAnnotation';
import { BookFormat } from '@domain/types';
import { describe, expect, it, vi } from 'vitest';

describe('Highlight & RichAnnotation Domain Entities', () => {
  it('updates updatedAt when calling updateNote, changeColor, setRichAnnotation, and removeRichAnnotation', () => {
    vi.useFakeTimers();
    const initialDate = new Date('2026-01-01T10:00:00Z');
    vi.setSystemTime(initialDate);

    const highlight = new Highlight('h-1', 'hash-123', 'Know thyself', '#eab308', {
      format: BookFormat.EPUB,
      pageNumber: 12,
      epubCfi: 'epubcfi(/6/4[chap01ref]!/4/2/1:0)',
    });

    expect(highlight.updatedAt.getTime()).toBe(initialDate.getTime());

    vi.advanceTimersByTime(5000);
    highlight.updateNote('  Delphic maxim  ');
    expect(highlight.note).toBe('Delphic maxim');
    const afterNoteTime = highlight.updatedAt.getTime();
    expect(afterNoteTime).toBeGreaterThan(initialDate.getTime());

    vi.advanceTimersByTime(5000);
    highlight.changeColor('#22c55e');
    expect(highlight.color).toBe('#22c55e');
    const afterColorTime = highlight.updatedAt.getTime();
    expect(afterColorTime).toBeGreaterThan(afterNoteTime);

    vi.advanceTimersByTime(5000);
    const mdAnnotation = createAssistedTextAnnotation('**Delphic maxim**');
    highlight.setRichAnnotation(mdAnnotation);
    const afterSetAnnotationTime = highlight.updatedAt.getTime();
    expect(afterSetAnnotationTime).toBeGreaterThan(afterColorTime);

    vi.advanceTimersByTime(5000);
    highlight.removeRichAnnotation('assisted-markdown');
    expect(highlight.getRichAnnotation('assisted-markdown')).toBeUndefined();
    expect(highlight.updatedAt.getTime()).toBeGreaterThan(afterSetAnnotationTime);

    vi.useRealTimers();
  });

  it('supports Discriminated Union annotations and Handler Map formatting', () => {
    const highlight = new Highlight('h-2', 'hash-123', 'Allegory of the Cave', '#3b82f6', {
      format: BookFormat.EPUB,
      pageNumber: 42,
      epubCfi: 'epubcfi(/6/8!/4/2/1:0)',
    });

    const textAnnotation = createAssistedTextAnnotation('**Plato** _Republic_ Book VII');
    highlight.setRichAnnotation(textAnnotation);

    expect(highlight.note).toBe('**Plato** _Republic_ Book VII');
    expect(highlight.getAllRichAnnotations()).toHaveLength(1);

    const formatterMap: AnnotationFormatterMap<string> = {
      'assisted-markdown': (node) => `MD:${node.rawData}`,
    };

    const formattedResults = highlight.formatAnnotations(formatterMap);
    expect(formattedResults).toEqual(['MD:**Plato** _Republic_ Book VII']);
  });

  it('detects exact CFI collision for EPUB highlights', () => {
    const highlight = new Highlight('h-epub', 'hash-1', 'Logos', '#f59e0b', {
      format: BookFormat.EPUB,
      pageNumber: 5,
      epubCfi: 'epubcfi(/6/2!/4/10:2)',
    });

    expect(
      highlight.overlapsWith({
        format: BookFormat.EPUB,
        pageNumber: 5,
        epubCfi: 'epubcfi(/6/2!/4/10:2)',
      })
    ).toBe(true);

    expect(
      highlight.overlapsWith({
        format: BookFormat.EPUB,
        pageNumber: 5,
        epubCfi: 'epubcfi(/6/2!/4/12:0)',
      })
    ).toBe(false);

    expect(
      highlight.overlapsWith({
        format: BookFormat.EPUB,
        pageNumber: 6,
        epubCfi: 'epubcfi(/6/2!/4/10:2)',
      })
    ).toBe(false);
  });

  it('detects geometric AABB BoundingBox intersection for PDF highlights', () => {
    const highlight = new Highlight('h-pdf', 'hash-2', 'Critique of Pure Reason', '#ef4444', {
      format: BookFormat.PDF,
      pageNumber: 10,
      pdfRects: [{ x: 100, y: 200, width: 150, height: 20 }],
    });

    expect(
      highlight.overlapsWith({
        format: BookFormat.PDF,
        pageNumber: 10,
        pdfRects: [{ x: 120, y: 205, width: 50, height: 15 }],
      })
    ).toBe(true);

    expect(
      highlight.overlapsWith({
        format: BookFormat.PDF,
        pageNumber: 10,
        pdfRects: [{ x: 300, y: 400, width: 80, height: 20 }],
      })
    ).toBe(false);

    expect(
      highlight.overlapsWith({
        format: BookFormat.PDF,
        pageNumber: 11,
        pdfRects: [{ x: 120, y: 205, width: 50, height: 15 }],
      })
    ).toBe(false);
  });
});
