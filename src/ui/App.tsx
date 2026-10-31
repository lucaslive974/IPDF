import { useCallback, useEffect, useRef, useState } from 'react';
import { InMemoryBookRepository } from '../../test/fakes/InMemoryBookRepository';
import { InMemoryFileStorage } from '../../test/fakes/InMemoryFileStorage';
import { InMemoryHighlightRepository } from '../../test/fakes/InMemoryHighlightRepository';
import { InMemoryRemoteStorageProvider } from '../../test/fakes/InMemoryRemoteStorageProvider';
import { JsonExportStrategy } from '../../test/fakes/JsonExportStrategy';
import { AssistedRichTextStrategy } from '../adapters/annotations/AssistedRichTextStrategy';
import {
  DrawioAnnotationStrategy,
  TldrawAnnotationStrategy,
} from '../adapters/annotations/DiagramAnnotationStrategies';
import type { Highlight } from '../core/domain/Highlight';
import type { IAnnotationVisitor } from '../core/domain/RichAnnotation';
import type { TextFormatStyle } from '../core/domain/types';
import { CloudlessSyncEngine } from '../core/services/CloudlessSyncEngine';
import { DataPortabilityService } from '../core/services/DataPortabilityService';
import { HighlightManager } from '../core/services/HighlightManager';
import { PromptBuilder } from '../core/services/PromptBuilder';

const BOOK_HASH = 'sha256-plato-republic-book-vii';
const SAMPLE_PARAGRAPH =
  'Behold! human beings living in an underground den, which has a mouth open towards the light ' +
  'and reaching all along the den; here they have been from their childhood, and have their legs ' +
  'and necks chained so that they cannot move, and can only see before them, being prevented by ' +
  'the chains from turning round their heads (noesis vs. doxa).';

export function App() {
  const servicesRef = useRef<{
    highlightManager: HighlightManager;
    syncEngine: CloudlessSyncEngine;
    portability: DataPortabilityService;
    jsonStrategy: JsonExportStrategy;
    promptBuilder: PromptBuilder;
  } | null>(null);

  if (!servicesRef.current) {
    const bookRepo = new InMemoryBookRepository();
    const highlightRepo = new InMemoryHighlightRepository();
    const fileStorage = new InMemoryFileStorage();
    const remoteStorage = new InMemoryRemoteStorageProvider();
    const jsonStrategy = new JsonExportStrategy();

    const highlightManager = new HighlightManager(highlightRepo, [
      new AssistedRichTextStrategy(),
      new TldrawAnnotationStrategy(),
      new DrawioAnnotationStrategy(),
    ]);

    const portability = new DataPortabilityService(bookRepo, highlightRepo, fileStorage);
    const syncEngine = new CloudlessSyncEngine(remoteStorage, portability, jsonStrategy);

    servicesRef.current = {
      highlightManager,
      syncEngine,
      portability,
      jsonStrategy,
      promptBuilder: new PromptBuilder(),
    };
  }

  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [noteInput, setNoteInput] = useState('');
  const [selectionRange, setSelectionRange] = useState<{ start: number; end: number }>({
    start: 0,
    end: 0,
  });
  const [visitorOutput, setVisitorOutput] = useState<string[]>([]);
  const [syncExportPreview, setSyncExportPreview] = useState<string>('');
  const [llmPromptPreview, setLlmPromptPreview] = useState<string>('');

  const refreshState = useCallback(
    async (activeHighlightId?: string | null) => {
      const svc = servicesRef.current;
      if (!svc) {
        return;
      }
      const pageHighlights = svc.highlightManager.getForPage(1);
      setHighlights([...pageHighlights]);

      const targetId = activeHighlightId ?? selectedId ?? pageHighlights[0]?.id ?? null;
      if (targetId) {
        setSelectedId(targetId);
        const found = pageHighlights.find((h) => h.id === targetId);
        if (found) {
          setNoteInput(found.note);
          const visitor: IAnnotationVisitor<string> = {
            visitAssistedText: (node) => `[Assisted Text] ${node.rawData}`,
            visitTldrawBoard: (node) => `[tldraw Board] ${node.rawData} | SVG: ${node.svgPreview}`,
            visitDrawioDiagram: (node) =>
              `[draw.io Diagram] ${node.rawData} | SVG: ${node.svgPreview}`,
          };
          setVisitorOutput(svc.highlightManager.visitHighlightAnnotations(targetId, visitor));
        }
      }
    },
    [selectedId]
  );

  useEffect(() => {
    const init = async () => {
      const svc = servicesRef.current;
      if (!svc) {
        return;
      }
      await svc.highlightManager.loadBookHighlights(BOOK_HASH);
      const existing = svc.highlightManager.getForPage(1);
      if (existing.length === 0) {
        const created = await svc.highlightManager.createFromSelection(
          BOOK_HASH,
          {
            text: 'noesis vs. doxa',
            surroundingContext: SAMPLE_PARAGRAPH,
            anchor: { format: 'epub', pageNumber: 1, epubCfi: 'epubcfi(/6/14!/4/2/1:120)' },
            clientRect: {
              x: 0,
              y: 0,
              width: 120,
              height: 20,
              top: 0,
              right: 120,
              bottom: 20,
              left: 0,
              toJSON: () => ({}),
            } as DOMRect,
          },
          '#eab308',
          'Transition from sensory opinion to pure intellection'
        );
        await refreshState(created.id);
      } else {
        await refreshState(existing[0].id);
      }
    };
    void init();
  }, [refreshState]);

  const handleCreateHighlightFromSelection = async (color: string) => {
    const svc = servicesRef.current;
    if (!svc) {
      return;
    }
    const browserSel = window.getSelection()?.toString().trim();
    const textToHighlight =
      browserSel && browserSel.length > 0
        ? browserSel
        : 'human beings living in an underground den';

    const created = await svc.highlightManager.createFromSelection(
      BOOK_HASH,
      {
        text: textToHighlight,
        surroundingContext: SAMPLE_PARAGRAPH,
        anchor: {
          format: 'epub',
          pageNumber: 1,
          epubCfi: `epubcfi(/6/14!/4/2/${Date.now()})`,
        },
        clientRect: {
          x: 0,
          y: 0,
          width: 100,
          height: 20,
          top: 0,
          right: 100,
          bottom: 20,
          left: 0,
          toJSON: () => ({}),
        } as DOMRect,
      },
      color,
      'New section study annotation'
    );
    await refreshState(created.id);
  };

  const handleApplyAssistedFormat = async (style: TextFormatStyle) => {
    const svc = servicesRef.current;
    if (!svc || !selectedId) {
      return;
    }
    await svc.highlightManager.interactWithAnnotation(selectedId, 'assisted-markdown', {
      target: 'assisted-markdown',
      action: 'replace-text',
      text: noteInput,
    });

    const range =
      selectionRange.end > selectionRange.start
        ? selectionRange
        : { start: 0, end: noteInput.length };

    await svc.highlightManager.interactWithAnnotation(selectedId, 'assisted-markdown', {
      target: 'assisted-markdown',
      action: 'apply-format',
      selectionRange: range,
      formatStyle: style,
    });
    await refreshState(selectedId);
  };

  const handleAttachVisualBoard = async (kind: 'tldraw' | 'drawio') => {
    const svc = servicesRef.current;
    if (!svc || !selectedId) {
      return;
    }
    if (kind === 'tldraw') {
      await svc.highlightManager.interactWithAnnotation(selectedId, 'tldraw', {
        target: 'tldraw',
        action: 'save-snapshot',
        snapshotJson: '{"shapes":[{"type":"arrow","from":"Doxa","to":"Noesis"}]}',
        svgPreview: '<svg viewBox="0 0 120 40"><text>tldraw: Doxa -> Noesis</text></svg>',
      });
    } else {
      await svc.highlightManager.interactWithAnnotation(selectedId, 'drawio', {
        target: 'drawio',
        action: 'save-diagram',
        xmlOrJsonDiagram:
          '<mxGraphModel><root><mxCell id="intelligible-realm"/></root></mxGraphModel>',
        svgPreview: '<svg viewBox="0 0 120 40"><text>draw.io: Divided Line</text></svg>',
      });
    }
    await refreshState(selectedId);
  };

  const handleGeneratePrompt = () => {
    const svc = servicesRef.current;
    if (!svc) {
      return;
    }
    const active = highlights.find((h) => h.id === selectedId);
    const req = svc.promptBuilder.buildTermLookupRequest(
      {
        bookTitle: 'The Republic',
        bookAuthor: 'Plato',
        chapterTitle: 'Book VII — Allegory of the Cave',
        selectedText: active?.text ?? 'noesis',
        surroundingContext: SAMPLE_PARAGRAPH,
      },
      'en'
    );
    setLlmPromptPreview(JSON.stringify(req, null, 2));
  };

  const handleRunCloudlessSync = async () => {
    const svc = servicesRef.current;
    if (!svc) {
      return;
    }
    await svc.syncEngine.syncBookState(BOOK_HASH);
    const exported = await svc.portability.exportData(
      { bookHashes: [BOOK_HASH], includeBookFiles: false, format: 'json-only' },
      svc.jsonStrategy
    );
    setSyncExportPreview(
      typeof exported === 'string'
        ? JSON.stringify(JSON.parse(exported), null, 2)
        : 'Binary Uint8Array'
    );
  };

  return (
    <div className="app-layout">
      <section className="panel">
        <div className="header-bar">
          <div>
            <h2 style={{ margin: 0 }}>Plato — The Republic (Book VII)</h2>
            <small style={{ color: 'var(--text-muted)' }}>
              SHA-256 Hash: <code>{BOOK_HASH}</code>
            </small>
          </div>
          <span className="badge">Phase 1 Core Workbench</span>
        </div>

        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Select any passage below (or click a color button) to create a polymorphic highlight
          managed by <code>HighlightManager</code>:
        </p>

        <div className="book-passage">{SAMPLE_PARAGRAPH}</div>

        <div className="toolbar">
          <button
            type="button"
            className="primary"
            onClick={() => void handleCreateHighlightFromSelection('#eab308')}
          >
            + Highlight Yellow
          </button>
          <button type="button" onClick={() => void handleCreateHighlightFromSelection('#22c55e')}>
            + Highlight Green
          </button>
          <button type="button" onClick={() => void handleCreateHighlightFromSelection('#38bdf8')}>
            + Highlight Blue
          </button>
          <button type="button" onClick={handleGeneratePrompt}>
            Generate Contextual Prompt (LLM)
          </button>
          <button type="button" onClick={() => void handleRunCloudlessSync()}>
            Sync LWW (CloudlessSyncEngine)
          </button>
        </div>

        <h3 style={{ margin: '0.5rem 0 0 0' }}>Page 1 Highlights ({highlights.length})</h3>
        {highlights.map((hl) => (
          <div
            key={hl.id}
            className={`highlight-card ${hl.id === selectedId ? 'active' : ''}`}
            style={{ borderLeftColor: hl.color }}
            onClick={() => void refreshState(hl.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                void refreshState(hl.id);
              }
            }}
          >
            <strong>“{hl.text}”</strong>
            <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
              Note: {hl.note || '(empty)'}
            </div>
          </div>
        ))}
      </section>

      <section className="panel">
        <div className="header-bar">
          <h3 style={{ margin: 0 }}>Section Annotations (Strategy + Visitor / Double Dispatch)</h3>
        </div>

        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.88rem' }}>
          Assisted Rich Formatting (<code>AssistedRichTextStrategy</code>) — select text in the note
          box below or apply formatting directly without writing Markdown syntax:
        </p>

        <div className="toolbar">
          <button type="button" onClick={() => void handleApplyAssistedFormat({ kind: 'bold' })}>
            <strong>B</strong> Bold
          </button>
          <button type="button" onClick={() => void handleApplyAssistedFormat({ kind: 'italic' })}>
            <em>I</em> Italic
          </button>
          <button
            type="button"
            onClick={() => void handleApplyAssistedFormat({ kind: 'underline' })}
          >
            <u>U</u> Underline
          </button>
          <button
            type="button"
            onClick={() =>
              void handleApplyAssistedFormat({ kind: 'textColor', colorHex: '#38bdf8' })
            }
          >
            Blue Text
          </button>
          <button
            type="button"
            onClick={() =>
              void handleApplyAssistedFormat({ kind: 'backgroundColor', colorHex: '#ca8a04' })
            }
          >
            Mark Fill
          </button>
          <button
            type="button"
            onClick={() => void handleApplyAssistedFormat({ kind: 'blockquote' })}
          >
            ❝ Quote
          </button>
        </div>

        <textarea
          value={noteInput}
          onChange={(e) => setNoteInput(e.target.value)}
          onSelect={(e) => {
            const target = e.currentTarget;
            setSelectionRange({
              start: target.selectionStart,
              end: target.selectionEnd,
            });
          }}
        />

        <div className="toolbar">
          <button
            type="button"
            className="primary"
            onClick={() => void handleAttachVisualBoard('tldraw')}
          >
            + Attach Whiteboard (tldraw Strategy)
          </button>
          <button
            type="button"
            className="primary"
            onClick={() => void handleAttachVisualBoard('drawio')}
          >
            + Attach Diagram (draw.io Strategy)
          </button>
        </div>

        <div>
          <strong>
            Visitor Pattern Output (<code>acceptAnnotationVisitor</code>):
          </strong>
          <pre className="code-box">
            {visitorOutput.length > 0
              ? visitorOutput.join('\n')
              : 'No rich annotations attached yet.'}
          </pre>
        </div>

        {llmPromptPreview && (
          <div>
            <strong>
              Generated Prompt (<code>PromptBuilder</code>):
            </strong>
            <pre className="code-box">{llmPromptPreview}</pre>
          </div>
        )}

        {syncExportPreview && (
          <div>
            <strong>
              LWW Synced Payload (<code>CloudlessSyncEngine</code>):
            </strong>
            <pre className="code-box">{syncExportPreview}</pre>
          </div>
        )}
      </section>
    </div>
  );
}
