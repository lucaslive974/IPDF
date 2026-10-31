import { beforeEach, describe, expect, it } from 'vitest';
import { AssistedRichTextStrategy } from '../../../adapters/annotations/AssistedRichTextStrategy';
import {
  DrawioAnnotationStrategy,
  TldrawAnnotationStrategy,
} from '../../../adapters/annotations/DiagramAnnotationStrategies';
import type { AnnotationFormatterMap } from '../../../core/domain/RichAnnotation';
import { AnnotationWorkbenchService } from '../../../core/services/AnnotationWorkbenchService';
import { MockBackend } from '../../mocks/MockBackend';

const createEmptyRect = (): DOMRect =>
  ({
    x: 0,
    y: 0,
    width: 100,
    height: 20,
    top: 0,
    right: 100,
    bottom: 20,
    left: 0,
    toJSON: () => ({}),
  }) as DOMRect;

describe('AnnotationWorkbenchService (60fps Frontend Strategy + Backend Persistence)', () => {
  let backend: MockBackend;
  let service: AnnotationWorkbenchService;

  beforeEach(() => {
    backend = new MockBackend();
    service = new AnnotationWorkbenchService(backend, [
      new AssistedRichTextStrategy(),
      new TldrawAnnotationStrategy(),
      new DrawioAnnotationStrategy(),
    ]);
  });

  it('should create a highlight, persist via gateway, and merge overlapping selections', async () => {
    const selection = {
      text: 'Phenomenology of Spirit',
      surroundingContext: 'Preface to the Phenomenology of Spirit.',
      anchor: { format: 'epub' as const, pageNumber: 1, epubCfi: 'epubcfi(/6/2!/4/2)' },
      clientRect: createEmptyRect(),
    };

    const created = await service.createFromSelection(
      'book_1',
      selection,
      '#FFEB3B',
      'Initial note'
    );
    expect(service.getForPage(1)).toHaveLength(1);

    const merged = await service.createFromSelection(
      'book_1',
      selection,
      '#4CAF50',
      'Updated note'
    );
    expect(merged.id).toBe(created.id);
    expect(merged.color).toBe('#4CAF50');
    expect(merged.note).toBe('Updated note');
    expect(service.getForPage(1)).toHaveLength(1);
  });

  it('should apply all assisted formatting styles and diagram commands via Command Dispatch', async () => {
    const hl = await service.createFromSelection(
      'book_1',
      {
        text: 'Dialectics',
        surroundingContext: 'Hegelian dialectics.',
        anchor: { format: 'epub', pageNumber: 2, epubCfi: 'epubcfi(/6/4!/4/2)' },
        clientRect: createEmptyRect(),
      },
      '#FFEB3B',
      'Thesis Antithesis Synthesis'
    );

    await service.interactWithAnnotation(hl.id, 'assisted-markdown', {
      target: 'assisted-markdown',
      action: 'apply-format',
      selectionRange: { start: 0, end: 6 },
      formatStyle: { kind: 'bold' },
    });

    await service.interactWithAnnotation(hl.id, 'assisted-markdown', {
      target: 'assisted-markdown',
      action: 'apply-format',
      selectionRange: { start: 0, end: 10 },
      formatStyle: { kind: 'italic' },
    });

    await service.interactWithAnnotation(hl.id, 'assisted-markdown', {
      target: 'assisted-markdown',
      action: 'apply-format',
      selectionRange: { start: 0, end: 10 },
      formatStyle: { kind: 'underline' },
    });

    await service.interactWithAnnotation(hl.id, 'assisted-markdown', {
      target: 'assisted-markdown',
      action: 'apply-format',
      selectionRange: { start: 0, end: 10 },
      formatStyle: { kind: 'strikethrough' },
    });

    await service.interactWithAnnotation(hl.id, 'assisted-markdown', {
      target: 'assisted-markdown',
      action: 'apply-format',
      selectionRange: { start: 0, end: 10 },
      formatStyle: { kind: 'textColor', colorHex: '#ff0000' },
    });

    await service.interactWithAnnotation(hl.id, 'assisted-markdown', {
      target: 'assisted-markdown',
      action: 'apply-format',
      selectionRange: { start: 0, end: 10 },
      formatStyle: { kind: 'backgroundColor', colorHex: '#ffff00' },
    });

    await service.interactWithAnnotation(hl.id, 'assisted-markdown', {
      target: 'assisted-markdown',
      action: 'apply-format',
      selectionRange: { start: 0, end: 10 },
      formatStyle: { kind: 'heading', level: 2 },
    });

    await service.interactWithAnnotation(hl.id, 'assisted-markdown', {
      target: 'assisted-markdown',
      action: 'apply-format',
      selectionRange: { start: 0, end: 10 },
      formatStyle: { kind: 'bulletList' },
    });

    await service.interactWithAnnotation(hl.id, 'assisted-markdown', {
      target: 'assisted-markdown',
      action: 'apply-format',
      selectionRange: { start: 0, end: 10 },
      formatStyle: { kind: 'orderedList' },
    });

    await service.interactWithAnnotation(hl.id, 'assisted-markdown', {
      target: 'assisted-markdown',
      action: 'apply-format',
      selectionRange: { start: 0, end: 10 },
      formatStyle: { kind: 'blockquote' },
    });

    await service.interactWithAnnotation(hl.id, 'assisted-markdown', {
      target: 'assisted-markdown',
      action: 'insert-text',
      text: 'Added appendix',
    });

    await service.interactWithAnnotation(hl.id, 'tldraw', {
      target: 'tldraw',
      action: 'save-snapshot',
      snapshotJson: '{"shapes":[1]}',
      svgPreview: '<svg>tldraw</svg>',
    });

    await service.interactWithAnnotation(hl.id, 'drawio', {
      target: 'drawio',
      action: 'save-diagram',
      xmlOrJsonDiagram: '<mxGraphModel/>',
      svgPreview: '<svg>drawio</svg>',
    });

    const formatterMap: AnnotationFormatterMap<string> = {
      'assisted-markdown': (n) => `TEXT:${n.rawData.length > 0}`,
      tldraw: (n) => `TLDRAW:${n.svgPreview}`,
      drawio: (n) => `DRAWIO:${n.svgPreview}`,
    };

    const formatted = service.formatHighlightAnnotations(hl.id, formatterMap);
    expect(formatted).toEqual([
      'TEXT:true',
      'TLDRAW:<svg>tldraw</svg>',
      'DRAWIO:<svg>drawio</svg>',
    ]);

    await service.interactWithAnnotation(hl.id, 'tldraw', {
      target: 'tldraw',
      action: 'clear-canvas',
    });

    await service.interactWithAnnotation(hl.id, 'drawio', {
      target: 'drawio',
      action: 'clear-diagram',
    });

    await service.removeHighlight(hl.id);
    expect(service.getForPage(2)).toHaveLength(0);
  });

  it('should reload book highlights from gateway and guard invalid IDs', async () => {
    const hl = await service.createFromSelection('book_reload', {
      text: 'Reloadable',
      surroundingContext: 'Context',
      anchor: { format: 'epub', pageNumber: 1, epubCfi: 'epubcfi(/6/2!/4/4)' },
      clientRect: createEmptyRect(),
    });

    const reloaded = await service.loadBookHighlights('book_reload');
    expect(reloaded).toHaveLength(1);
    expect(reloaded[0]?.id).toBe(hl.id);

    await expect(
      service.interactWithAnnotation('missing_id', 'assisted-markdown', {
        target: 'assisted-markdown',
        action: 'replace-text',
        text: 'Fail',
      })
    ).rejects.toThrow('Highlight not found');

    const bareService = new AnnotationWorkbenchService(backend);
    const bareHl = await bareService.createFromSelection('book_bare', {
      text: 'No strategy',
      surroundingContext: 'Context',
      anchor: { format: 'epub', pageNumber: 1, epubCfi: 'epubcfi(/6/2!/4/6)' },
      clientRect: createEmptyRect(),
    });

    await expect(
      bareService.interactWithAnnotation(bareHl.id, 'assisted-markdown', {
        target: 'assisted-markdown',
        action: 'replace-text',
        text: 'Fail',
      })
    ).rejects.toThrow('Annotation tool strategy not registered');

    expect(() =>
      bareService.formatHighlightAnnotations('missing_id', {
        'assisted-markdown': () => 'text',
        tldraw: () => 'canvas',
        drawio: () => 'diagram',
      })
    ).toThrow('Highlight not found');
  });
});
