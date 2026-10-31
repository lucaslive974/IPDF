import type { TextFormatStyle } from '../../core/domain/types';
import { AssistedFormattingToolbar } from './AssistedFormattingToolbar';
import { CodeInspectorBox } from './CodeInspectorBox';

export interface SectionAnnotationPanelProps {
  readonly noteInput: string;
  readonly visitorOutput: string[];
  readonly llmPromptPreview: string;
  readonly syncExportPreview: string;
  readonly onNoteChange: (value: string) => void;
  readonly onSelectionChange: (start: number, end: number) => void;
  readonly onApplyFormat: (style: TextFormatStyle) => void;
  readonly onAttachBoard: (kind: 'tldraw' | 'drawio') => void;
}

export function SectionAnnotationPanel({
  noteInput,
  visitorOutput,
  llmPromptPreview,
  syncExportPreview,
  onNoteChange,
  onSelectionChange,
  onApplyFormat,
  onAttachBoard,
}: SectionAnnotationPanelProps) {
  return (
    <section className="panel">
      <div className="header-bar">
        <h3 style={{ margin: 0 }}>Section Annotations (Strategy + Visitor / Double Dispatch)</h3>
      </div>

      <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.88rem' }}>
        Assisted Rich Formatting (<code>AssistedRichTextStrategy</code>) — select text in the note
        box below or apply formatting directly without writing Markdown syntax:
      </p>

      <AssistedFormattingToolbar onApplyFormat={onApplyFormat} />

      <textarea
        value={noteInput}
        onChange={(event) => onNoteChange(event.target.value)}
        onSelect={(event) => {
          const target = event.currentTarget;
          onSelectionChange(target.selectionStart, target.selectionEnd);
        }}
      />

      <div className="toolbar">
        <button type="button" className="primary" onClick={() => onAttachBoard('tldraw')}>
          + Attach Whiteboard (tldraw Strategy)
        </button>
        <button type="button" className="primary" onClick={() => onAttachBoard('drawio')}>
          + Attach Diagram (draw.io Strategy)
        </button>
      </div>

      <CodeInspectorBox
        title="Visitor Pattern Output"
        codeSymbol="acceptAnnotationVisitor"
        content={
          visitorOutput.length > 0 ? visitorOutput.join('\n') : 'No rich annotations attached yet.'
        }
      />

      {llmPromptPreview ? (
        <CodeInspectorBox
          title="Generated Prompt"
          codeSymbol="PromptBuilder"
          content={llmPromptPreview}
        />
      ) : null}

      {syncExportPreview ? (
        <CodeInspectorBox
          title="LWW Synced Payload"
          codeSymbol="CloudlessSyncEngine"
          content={syncExportPreview}
        />
      ) : null}
    </section>
  );
}
