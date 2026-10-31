import { describe, expect, it } from 'vitest';
import { AssistedRichTextStrategy } from '../../../src/adapters/annotations/AssistedRichTextStrategy';
import {
  DrawioAnnotationStrategy,
  TldrawAnnotationStrategy,
} from '../../../src/adapters/annotations/DiagramAnnotationStrategies';
import { Highlight } from '../../../src/core/domain/Highlight';
import type { IAnnotationVisitor } from '../../../src/core/domain/RichAnnotation';
import type { TextSelection } from '../../../src/core/domain/types';
import { HighlightManager } from '../../../src/core/services/HighlightManager';
import { InMemoryHighlightRepository } from '../../fakes/InMemoryHighlightRepository';

const makeMockRect = (): DOMRect =>
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

describe('HighlightManager Service & Annotation Strategies', () => {
  it('loads book highlights into internal cache and filters by page via getForPage(n)', async () => {
    const repo = new InMemoryHighlightRepository();
    await repo.save(
      new Highlight('h-p1', 'book-1', 'Page 1 quote', '#eab308', {
        format: 'epub',
        pageNumber: 1,
        epubCfi: 'epubcfi(/6/2!/4/2:0)',
      })
    );
    await repo.save(
      new Highlight('h-p2', 'book-1', 'Page 2 quote', '#3b82f6', {
        format: 'epub',
        pageNumber: 2,
        epubCfi: 'epubcfi(/6/4!/4/2:0)',
      })
    );

    const manager = new HighlightManager(repo);
    const loaded = await manager.loadBookHighlights('book-1');

    expect(loaded).toHaveLength(2);
    expect(manager.getForPage(1).map((h) => h.id)).toEqual(['h-p1']);
    expect(manager.getForPage(2).map((h) => h.id)).toEqual(['h-p2']);
    expect(manager.getForPage(3)).toEqual([]);
  });

  it('persists new highlights created from selection and updates internal cache', async () => {
    const repo = new InMemoryHighlightRepository();
    const manager = new HighlightManager(repo);

    const selection: TextSelection = {
      text: 'The unexamined life is not worth living',
      surroundingContext: 'Socrates said at his trial: The unexamined life is not worth living.',
      anchor: {
        format: 'pdf',
        pageNumber: 7,
        pdfRects: [{ x: 10, y: 20, width: 200, height: 18 }],
      },
      clientRect: makeMockRect(),
    };

    const created = await manager.createFromSelection(
      'book-apology',
      selection,
      '#22c55e',
      'Apology 38a'
    );

    expect(created.text).toBe('The unexamined life is not worth living');
    expect(manager.getForPage(7)).toHaveLength(1);

    const persisted = await repo.findById(created.id);
    expect(persisted).not.toBeNull();
    expect(persisted?.note).toBe('Apology 38a');
  });

  it('composes IAnnotationToolStrategy to apply assisted formatting (bold, underline, color) and diagrams (tldraw, draw.io)', async () => {
    const repo = new InMemoryHighlightRepository();
    const manager = new HighlightManager(repo, [
      new AssistedRichTextStrategy(),
      new TldrawAnnotationStrategy(),
      new DrawioAnnotationStrategy(),
    ]);

    const selection: TextSelection = {
      text: 'Eudaimonia',
      surroundingContext: 'Aristotle defines Eudaimonia in Nicomachean Ethics.',
      anchor: { format: 'epub', pageNumber: 15, epubCfi: 'epubcfi(/6/10!/4/2:0)' },
      clientRect: makeMockRect(),
    };

    const highlight = await manager.createFromSelection(
      'book-ethics',
      selection,
      '#f59e0b',
      'Human flourishing'
    );

    // 1. User applies bold to "Human" (0..5) via toolbar button without typing Markdown
    await manager.interactWithAnnotation(highlight.id, 'assisted-markdown', {
      target: 'assisted-markdown',
      action: 'apply-format',
      selectionRange: { start: 0, end: 5 },
      formatStyle: { kind: 'bold' },
    });

    // 2. User applies underline to "flourishing" (9..20)
    await manager.interactWithAnnotation(highlight.id, 'assisted-markdown', {
      target: 'assisted-markdown',
      action: 'apply-format',
      selectionRange: { start: 10, end: 21 },
      formatStyle: { kind: 'underline' },
    });

    // 3. User attaches a tldraw sketch and a draw.io concept diagram to the section
    await manager.interactWithAnnotation(highlight.id, 'tldraw', {
      target: 'tldraw',
      action: 'save-snapshot',
      snapshotJson: '{"document":{"id":"tldraw-1"}}',
      svgPreview: '<svg id="tldraw-svg"/>',
    });

    await manager.interactWithAnnotation(highlight.id, 'drawio', {
      target: 'drawio',
      action: 'save-diagram',
      xmlOrJsonDiagram: '<mxGraphModel><root/></mxGraphModel>',
      svgPreview: '<svg id="drawio-svg"/>',
    });

    const updated = await repo.findById(highlight.id);
    expect(updated?.note).toBe('**Human** <u>flourishing</u>');

    const exportVisitor: IAnnotationVisitor<string> = {
      visitAssistedText: (a) => `TEXT:${a.rawData}`,
      visitTldrawBoard: (a) => `WHITEBOARD:${a.svgPreview}`,
      visitDrawioDiagram: (a) => `DIAGRAM:${a.svgPreview}`,
    };

    const exported = manager.visitHighlightAnnotations(highlight.id, exportVisitor);
    expect(exported).toEqual([
      'TEXT:**Human** <u>flourishing</u>',
      'WHITEBOARD:<svg id="tldraw-svg"/>',
      'DIAGRAM:<svg id="drawio-svg"/>',
    ]);
  });

  it('supports all assisted formatting styles, serialize/deserialize, and clear commands on strategies', async () => {
    const repo = new InMemoryHighlightRepository();
    const textStrategy = new AssistedRichTextStrategy();
    const tldrawStrategy = new TldrawAnnotationStrategy();
    const drawioStrategy = new DrawioAnnotationStrategy();

    expect(
      textStrategy.formatSelection('Item 1\nItem 2', { start: 0, end: 13 }, { kind: 'italic' })
    ).toBe('*Item 1\nItem 2*');
    expect(
      textStrategy.formatSelection('Strike', { start: 0, end: 6 }, { kind: 'strikethrough' })
    ).toBe('~~Strike~~');
    expect(
      textStrategy.formatSelection(
        'Colored',
        { start: 0, end: 7 },
        { kind: 'textColor', colorHex: '#38bdf8' }
      )
    ).toBe('<span style="color:#38bdf8">Colored</span>');
    expect(
      textStrategy.formatSelection(
        'Marked',
        { start: 0, end: 6 },
        { kind: 'backgroundColor', colorHex: '#eab308' }
      )
    ).toBe('<mark style="background-color:#eab308">Marked</mark>');
    expect(
      textStrategy.formatSelection('Title', { start: 0, end: 5 }, { kind: 'heading', level: 2 })
    ).toBe('## Title');
    expect(textStrategy.formatSelection('A\nB', { start: 0, end: 3 }, { kind: 'bulletList' })).toBe(
      '- A\n- B'
    );
    expect(
      textStrategy.formatSelection('A\nB', { start: 0, end: 3 }, { kind: 'orderedList' })
    ).toBe('1. A\n2. B');
    expect(
      textStrategy.formatSelection('Quote', { start: 0, end: 5 }, { kind: 'blockquote' })
    ).toBe('> Quote');

    const deserializedText = textStrategy.deserialize('**Hello**');
    expect(textStrategy.serialize(deserializedText)).toBe('**Hello**');

    const deserializedTldraw = tldrawStrategy.deserialize('{"v":1}', new Date(), '<svg/>');
    expect(tldrawStrategy.serialize(deserializedTldraw)).toBe('{"v":1}');

    const deserializedDrawio = drawioStrategy.deserialize('<mxGraphModel/>', new Date(), '<svg/>');
    expect(drawioStrategy.serialize(deserializedDrawio)).toBe('<mxGraphModel/>');

    const manager = new HighlightManager(repo, [textStrategy, tldrawStrategy, drawioStrategy]);
    const hl = await manager.createFromSelection(
      'book-1',
      {
        text: 'Passage',
        surroundingContext: 'Context',
        anchor: { format: 'epub', pageNumber: 1, epubCfi: 'cfi-1' },
        clientRect: makeMockRect(),
      },
      '#eab308',
      'Initial'
    );

    await manager.interactWithAnnotation(hl.id, 'assisted-markdown', {
      target: 'assisted-markdown',
      action: 'insert-text',
      text: 'Appended line',
    });
    await manager.interactWithAnnotation(hl.id, 'tldraw', {
      target: 'tldraw',
      action: 'clear-canvas',
    });
    await manager.interactWithAnnotation(hl.id, 'drawio', {
      target: 'drawio',
      action: 'clear-diagram',
    });

    const updated = await repo.findById(hl.id);
    expect(updated?.note).toBe('Initial\nAppended line');
    expect(updated?.getRichAnnotation('tldraw')?.rawData).toBe('{}');
    expect(updated?.getRichAnnotation('drawio')?.rawData).toBe('<mxGraphModel/>');
  });
});
