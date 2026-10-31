import { useState } from 'react';
import { Button, Dialog } from './ui';

export interface NoteDialogProps {
  readonly isOpen: boolean;
  readonly text: string;
  readonly initialColor?: string;
  readonly initialNote?: string;
  readonly onSave: (colorHex: string, note: string) => void;
  readonly onOpenStudio?: () => void;
  readonly onClose: () => void;
}

const COLOR_CHOICES = [
  { label: 'Amber', hex: '#d97706', classBg: 'bg-amber-600/70' },
  { label: 'Emerald', hex: '#059669', classBg: 'bg-emerald-600/70' },
  { label: 'Sky', hex: '#0284c7', classBg: 'bg-sky-600/70' },
  { label: 'Purple', hex: '#7c3aed', classBg: 'bg-purple-600/70' },
  { label: 'Rose', hex: '#e11d48', classBg: 'bg-rose-600/70' },
];

export function NoteDialog({
  isOpen,
  text,
  initialColor = '#d97706',
  initialNote = '',
  onSave,
  onOpenStudio,
  onClose,
}: NoteDialogProps) {
  const [selectedColor, setSelectedColor] = useState<string>(initialColor);
  const [noteContent, setNoteContent] = useState<string>(initialNote);

  const handleSave = () => {
    onSave(selectedColor, noteContent.trim());
    onClose();
  };

  return (
    <Dialog
      isOpen={isOpen}
      title="Add Study Note"
      subtitle="Attach reflections and contextual margin notes to your reading."
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          {onOpenStudio && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                onClose();
                onOpenStudio();
              }}
            >
              Open Studio &rarr;
            </Button>
          )}
          <Button variant="primary" size="sm" onClick={handleSave}>
            Save Note
          </Button>
        </>
      }
    >
      {/* Selected passage quote */}
      <div className="rounded-lg border border-line-subtle/80 bg-surface-subtle/60 p-3 space-y-1">
        <span className="text-[0.62rem] font-medium text-tx-muted uppercase tracking-wider">
          Selected Passage
        </span>
        <p className="text-xs text-tx-main italic leading-relaxed border-l border-line-strong pl-2.5">
          &ldquo;{text}&rdquo;
        </p>
      </div>

      {/* Color Selection */}
      <div className="space-y-1.5">
        <span className="text-[0.68rem] font-medium text-tx-secondary block">Highlight Tone:</span>
        <div className="flex items-center gap-2">
          {COLOR_CHOICES.map((c) => (
            <button
              key={c.hex}
              type="button"
              title={c.label}
              className={`h-5 w-5 rounded-full ${c.classBg} transition-all duration-150 cursor-pointer ${
                selectedColor === c.hex
                  ? 'ring-2 ring-tx-main ring-offset-2 ring-offset-surface scale-110'
                  : 'hover:scale-105 opacity-70 hover:opacity-100'
              }`}
              onClick={() => setSelectedColor(c.hex)}
            />
          ))}
        </div>
      </div>

      {/* Note Textarea */}
      <div className="space-y-1.5">
        <label
          htmlFor="note-draft-textarea"
          className="text-[0.68rem] font-medium text-tx-secondary"
        >
          Margin Note:
        </label>
        <textarea
          id="note-draft-textarea"
          rows={4}
          value={noteContent}
          onChange={(e) => setNoteContent(e.target.value)}
          placeholder="Write your reflections, questions, or ideas about this passage..."
          className="w-full rounded-lg border border-line-subtle bg-surface-subtle p-3 text-xs text-tx-main placeholder:text-tx-faint focus:border-line-strong focus:outline-none transition-colors"
        />
      </div>
    </Dialog>
  );
}
