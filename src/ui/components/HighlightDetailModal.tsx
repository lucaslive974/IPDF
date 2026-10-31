import { useState } from 'react';
import type { Highlight } from '../../core/domain/Highlight';
import type { TextFormatStyle } from '../../core/domain/types';
import { AssistedFormattingToolbar } from './AssistedFormattingToolbar';

export interface HighlightDetailModalProps {
  readonly highlight: Highlight;
  readonly noteInput: string;
  readonly formattedAnnotations: string[];
  readonly llmPromptPreview: string;
  readonly onNoteChange: (text: string) => void;
  readonly onSelectionChange: (start: number, end: number) => void;
  readonly onApplyFormat: (style: TextFormatStyle) => void;
  readonly onAttachBoard: (kind: 'tldraw' | 'drawio') => void;
  readonly onGeneratePrompt: () => void;
  readonly onClose: () => void;
}

export function HighlightDetailModal({
  highlight,
  noteInput,
  formattedAnnotations,
  llmPromptPreview,
  onNoteChange,
  onSelectionChange,
  onApplyFormat,
  onAttachBoard,
  onGeneratePrompt,
  onClose,
}: HighlightDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'text' | 'visual' | 'ai'>('text');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 dark:bg-slate-950/80 backdrop-blur-md p-4 transition-opacity duration-200">
      <div className="relative flex h-[88vh] w-full max-w-4xl flex-col rounded-2xl border border-line-subtle bg-surface shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line-subtle bg-surface/90 px-6 py-4">
          <div className="flex items-center gap-3">
            <span
              className="h-3.5 w-3.5 rounded-full"
              style={{ backgroundColor: highlight.color }}
            />
            <div>
              <h3 className="text-base font-bold text-tx-main">
                Annotation Studio &mdash; Page {highlight.anchor.pageNumber}
              </h3>
              <p className="max-w-xl truncate text-xs text-tx-muted">
                &ldquo;{highlight.text}&rdquo;
              </p>
            </div>
          </div>
          <button
            type="button"
            className="rounded-lg border border-line-subtle bg-surface-subtle px-3 py-1.5 text-xs font-semibold text-tx-secondary hover:bg-surface-hover hover:text-tx-main transition active:scale-95"
            onClick={onClose}
          >
            Done ✕
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-line-subtle bg-surface-subtle/50 px-6">
          <button
            type="button"
            className={`border-b-2 px-4 py-2.5 text-xs font-semibold transition ${
              activeTab === 'text'
                ? 'border-brand text-brand'
                : 'border-transparent text-tx-muted hover:text-tx-main'
            }`}
            onClick={() => setActiveTab('text')}
          >
            📝 Assisted Text & Notes
          </button>
          <button
            type="button"
            className={`border-b-2 px-4 py-2.5 text-xs font-semibold transition ${
              activeTab === 'visual'
                ? 'border-brand text-brand'
                : 'border-transparent text-tx-muted hover:text-tx-main'
            }`}
            onClick={() => setActiveTab('visual')}
          >
            🎨 Boards (tldraw & draw.io)
          </button>
          <button
            type="button"
            className={`border-b-2 px-4 py-2.5 text-xs font-semibold transition ${
              activeTab === 'ai'
                ? 'border-brand text-brand'
                : 'border-transparent text-tx-muted hover:text-tx-main'
            }`}
            onClick={() => setActiveTab('ai')}
          >
            ✨ AI Tutor & Context
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'text' && (
            <div className="flex flex-col gap-4">
              <div className="rounded-lg border border-line-subtle bg-surface-subtle p-3.5">
                <span className="text-[0.7rem] uppercase font-bold tracking-wider text-tx-muted block mb-1">
                  Selected Excerpt
                </span>
                <p className="text-sm italic text-tx-main leading-relaxed">
                  &ldquo;{highlight.text}&rdquo;
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-tx-secondary">
                  Assisted Markdown Note
                </span>
                <AssistedFormattingToolbar onApplyFormat={onApplyFormat} />
                <textarea
                  className="min-h-36 w-full rounded-xl border border-line-subtle bg-surface-subtle p-4 font-mono text-xs text-tx-main leading-relaxed placeholder:text-tx-faint focus:border-brand focus:outline-none"
                  placeholder="Draft your philosophical analysis or thoughts here..."
                  value={noteInput}
                  onChange={(e) => onNoteChange(e.target.value)}
                  onSelect={(e) => {
                    const target = e.currentTarget;
                    onSelectionChange(target.selectionStart, target.selectionEnd);
                  }}
                />
              </div>

              {formattedAnnotations.length > 0 && (
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-semibold text-tx-muted">
                    Compiled Rich Annotations ({formattedAnnotations.length})
                  </span>
                  <div className="flex flex-col gap-1.5">
                    {formattedAnnotations.map((item, idx) => (
                      <div
                        key={`formatted-${idx + 1}`}
                        className="rounded-lg border border-line-subtle bg-surface-subtle/80 p-2.5 font-mono text-xs text-tx-secondary"
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'visual' && (
            <div className="flex flex-col gap-5">
              <p className="text-xs text-tx-muted">
                Attach freehand concept maps (
                <code className="text-tx-secondary font-semibold">tldraw</code>) or structured
                architectural flowcharts (
                <code className="text-tx-secondary font-semibold">draw.io</code>) tied directly to
                this passage:
              </p>

              <div className="flex gap-3">
                <button
                  type="button"
                  className="flex-1 rounded-xl border border-line-subtle bg-surface-subtle p-4 text-left transition hover:border-brand hover:bg-surface-hover active:scale-98"
                  onClick={() => onAttachBoard('tldraw')}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-tx-main">✏️ tldraw Whiteboard</span>
                    <span className="text-xs text-brand font-semibold">+ Attach Board</span>
                  </div>
                  <p className="mt-1 text-xs text-tx-muted">
                    Freeform infinite sketching canvas for philosophical mind maps.
                  </p>
                </button>

                <button
                  type="button"
                  className="flex-1 rounded-xl border border-line-subtle bg-surface-subtle p-4 text-left transition hover:border-brand hover:bg-surface-hover active:scale-98"
                  onClick={() => onAttachBoard('drawio')}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-tx-main">📊 draw.io Diagram</span>
                    <span className="text-xs text-brand font-semibold">+ Attach Diagram</span>
                  </div>
                  <p className="mt-1 text-xs text-tx-muted">
                    Structured nodes, logical hierarchies, and relational diagrams.
                  </p>
                </button>
              </div>

              <div className="rounded-xl border border-dashed border-line-subtle p-8 text-center text-xs text-tx-faint">
                Visual studio canvas viewport will load interactively in this container.
              </div>
            </div>
          )}

          {activeTab === 'ai' && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-tx-secondary">
                  Philosophical Tutor Prompt Construction
                </span>
                <button
                  type="button"
                  className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-brand-hover transition active:scale-95"
                  onClick={onGeneratePrompt}
                >
                  Regenerate Context Prompt
                </button>
              </div>

              <div className="rounded-xl border border-line-subtle bg-surface-subtle p-4 font-mono text-xs text-brand whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto">
                {llmPromptPreview ||
                  'Click "Regenerate Context Prompt" to inspect structured LLM prompt payload.'}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
