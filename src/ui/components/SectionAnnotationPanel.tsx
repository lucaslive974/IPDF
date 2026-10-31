import type { TextFormatStyle } from '../../core/domain/types';
import { AssistedFormattingToolbar } from './AssistedFormattingToolbar';
import { CodeInspectorBox } from './CodeInspectorBox';

export interface SectionAnnotationPanelProps {
  readonly noteInput: string;
  readonly formattedAnnotations: string[];
  readonly llmPromptPreview: string;
  readonly syncExportPreview: string;
  readonly onNoteChange: (value: string) => void;
  readonly onSelectionChange: (start: number, end: number) => void;
  readonly onApplyFormat: (style: TextFormatStyle) => void;
  readonly onAttachBoard: (kind: 'tldraw' | 'drawio') => void;
}

export function SectionAnnotationPanel({
  noteInput,
  formattedAnnotations,
  llmPromptPreview,
  syncExportPreview,
  onNoteChange,
  onSelectionChange,
  onApplyFormat,
  onAttachBoard,
}: SectionAnnotationPanelProps) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-900/90 p-5 shadow-lg">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <h3 className="text-lg font-semibold text-slate-100">
          Section Annotations (Discriminated Union &amp; Strategy Handlers)
        </h3>
      </div>

      <p className="text-sm text-slate-400">
        Assisted Rich Formatting (
        <code className="font-mono text-slate-300">AssistedRichTextStrategy</code>) — select text in
        the note box below or apply formatting directly without writing Markdown syntax:
      </p>

      <AssistedFormattingToolbar onApplyFormat={onApplyFormat} />

      <textarea
        className="min-h-24 w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm text-slate-100 focus:border-sky-400 focus:outline-none"
        value={noteInput}
        onChange={(event) => onNoteChange(event.target.value)}
        onSelect={(event) => {
          const target = event.currentTarget;
          onSelectionChange(target.selectionStart, target.selectionEnd);
        }}
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="cursor-pointer rounded-md border border-sky-400 bg-sky-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-sky-500"
          onClick={() => onAttachBoard('tldraw')}
        >
          + Attach Whiteboard (tldraw Strategy)
        </button>
        <button
          type="button"
          className="cursor-pointer rounded-md border border-sky-400 bg-sky-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-sky-500"
          onClick={() => onAttachBoard('drawio')}
        >
          + Attach Diagram (draw.io Strategy)
        </button>
      </div>

      <CodeInspectorBox
        title="Discriminated Union Format Map Output"
        codeSymbol="formatAnnotations"
        content={
          formattedAnnotations.length > 0
            ? formattedAnnotations.join('\n')
            : 'No rich annotations attached yet.'
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
