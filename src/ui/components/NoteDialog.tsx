import { useState } from 'react';
import { Button, ColorPicker, Dialog, PassageQuote } from './ui';

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
  { label: 'Amber', value: '#d97706' },
  { label: 'Emerald', value: '#059669' },
  { label: 'Sky', value: '#0284c7' },
  { label: 'Purple', value: '#7c3aed' },
  { label: 'Rose', value: '#e11d48' },
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
      <PassageQuote text={text} color={selectedColor} />

      <div className="space-y-1.5">
        <span className="text-[0.68rem] font-medium text-tx-secondary block">Highlight Tone:</span>
        <ColorPicker
          selectedColor={selectedColor}
          onSelectColor={setSelectedColor}
          colors={COLOR_CHOICES}
          size="sm"
        />
      </div>

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
