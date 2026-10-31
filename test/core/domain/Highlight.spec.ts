import { describe, expect, it, vi } from 'vitest';
import { Highlight } from '../../../src/core/domain/Highlight';
import {
  AssistedTextAnnotation,
  DrawioDiagramAnnotation,
  type IAnnotationVisitor,
  TldrawBoardAnnotation,
} from '../../../src/core/domain/RichAnnotation';

describe('Highlight & RichAnnotation Domain Entities', () => {
  it('updates updatedAt when calling updateNote, changeColor, setRichAnnotation, and removeRichAnnotation', () => {
    vi.useFakeTimers();
    const initialDate = new Date('2026-01-01T10:00:00Z');
    vi.setSystemTime(initialDate);

    const highlight = new Highlight('h-1', 'hash-123', 'Know thyself', '#eab308', {
      format: 'epub',
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
    const tldrawAnnotation = new TldrawBoardAnnotation('{"shapes":[]}', '<svg>board</svg>');
    highlight.setRichAnnotation(tldrawAnnotation);
    const afterSetAnnotationTime = highlight.updatedAt.getTime();
    expect(afterSetAnnotationTime).toBeGreaterThan(afterColorTime);

    vi.advanceTimersByTime(5000);
    highlight.removeRichAnnotation('tldraw');
    expect(highlight.getRichAnnotation('tldraw')).toBeUndefined();
    expect(highlight.updatedAt.getTime()).toBeGreaterThan(afterSetAnnotationTime);

    vi.useRealTimers();
  });

  it('supports Double Dispatch (attachTo) and Visitor Pattern (acceptAnnotationVisitor) without switch/case', () => {
    const highlight = new Highlight('h-2', 'hash-123', 'Allegory of the Cave', '#3b82f6', {
      format: 'epub',
      pageNumber: 42,
      epubCfi: 'epubcfi(/6/8!/4/2/1:0)',
    });

    const textAnnotation = new AssistedTextAnnotation('**Plato** _Republic_ Book VII');
    const tldrawAnnotation = new TldrawBoardAnnotation('{"store":{}}', '<svg>tldraw</svg>');
    const drawioAnnotation = new DrawioDiagramAnnotation('<mxGraphModel/>', '<svg>drawio</svg>');

    textAnnotation.attachTo(highlight);
    tldrawAnnotation.attachTo(highlight);
    drawioAnnotation.attachTo(highlight);

    expect(highlight.note).toBe('**Plato** _Republic_ Book VII');
    expect(highlight.getAllRichAnnotations()).toHaveLength(3);

    const visitor: IAnnotationVisitor<string> = {
      visitAssistedText: (node) => `MD:${node.rawData}`,
      visitTldrawBoard: (node) => `TLDRAW:${node.svgPreview}`,
      visitDrawioDiagram: (node) => `DRAWIO:${node.svgPreview}`,
    };

    const visitedResults = highlight.acceptAnnotationVisitor(visitor);
    expect(visitedResults).toEqual([
      'MD:**Plato** _Republic_ Book VII',
      'TLDRAW:<svg>tldraw</svg>',
      'DRAWIO:<svg>drawio</svg>',
    ]);
  });

  it('detects exact CFI collision for EPUB highlights', () => {
    const highlight = new Highlight('h-epub', 'hash-1', 'Logos', '#f59e0b', {
      format: 'epub',
      pageNumber: 5,
      epubCfi: 'epubcfi(/6/2!/4/10:2)',
    });

    expect(
      highlight.overlapsWith({
        format: 'epub',
        pageNumber: 5,
        epubCfi: 'epubcfi(/6/2!/4/10:2)',
      })
    ).toBe(true);

    expect(
      highlight.overlapsWith({
        format: 'epub',
        pageNumber: 5,
        epubCfi: 'epubcfi(/6/2!/4/12:0)',
      })
    ).toBe(false);

    expect(
      highlight.overlapsWith({
        format: 'epub',
        pageNumber: 6,
        epubCfi: 'epubcfi(/6/2!/4/10:2)',
      })
    ).toBe(false);
  });

  it('detects geometric AABB BoundingBox intersection for PDF highlights', () => {
    const highlight = new Highlight('h-pdf', 'hash-2', 'Critique of Pure Reason', '#ef4444', {
      format: 'pdf',
      pageNumber: 10,
      pdfRects: [{ x: 100, y: 200, width: 150, height: 20 }],
    });

    // Intersecting rectangle on same page
    expect(
      highlight.overlapsWith({
        format: 'pdf',
        pageNumber: 10,
        pdfRects: [{ x: 120, y: 205, width: 50, height: 15 }],
      })
    ).toBe(true);

    // Non-intersecting rectangle on same page
    expect(
      highlight.overlapsWith({
        format: 'pdf',
        pageNumber: 10,
        pdfRects: [{ x: 300, y: 400, width: 80, height: 20 }],
      })
    ).toBe(false);

    // Same coordinates but different page
    expect(
      highlight.overlapsWith({
        format: 'pdf',
        pageNumber: 11,
        pdfRects: [{ x: 120, y: 205, width: 50, height: 15 }],
      })
    ).toBe(false);
  });
});
