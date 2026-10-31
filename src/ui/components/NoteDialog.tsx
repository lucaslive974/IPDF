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
  { label: 'Amarelo', hex: '#eab308', classBg: 'bg-amber-400' },
  { label: 'Verde', hex: '#22c55e', classBg: 'bg-emerald-500' },
  { label: 'Azul', hex: '#38bdf8', classBg: 'bg-sky-400' },
  { label: 'Roxo', hex: '#a855f7', classBg: 'bg-purple-500' },
  { label: 'Rosa', hex: '#f43f5e', classBg: 'bg-rose-500' },
];

export function NoteDialog({
  isOpen,
  text,
  initialColor = '#eab308',
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
      title="Criar Nota de Estudo"
      subtitle="Vincule reflexões e marcações contextuais à sua leitura."
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          {onOpenStudio && (
            <Button
              variant="secondary"
              size="sm"
              iconRight="↗"
              onClick={() => {
                onClose();
                onOpenStudio();
              }}
            >
              Estúdio Completo
            </Button>
          )}
          <Button variant="primary" size="sm" iconLeft="💾" onClick={handleSave}>
            Salvar Nota & Grifo
          </Button>
        </>
      }
    >
      {/* Selected passage quote */}
      <div className="rounded-xl border border-line-subtle bg-surface-subtle/70 p-3.5 space-y-1">
        <span className="text-[0.65rem] font-semibold text-tx-muted uppercase tracking-wider">
          Trecho Selecionado
        </span>
        <p className="text-xs text-tx-main italic leading-relaxed border-l-2 border-line-strong pl-2.5">
          &ldquo;{text}&rdquo;
        </p>
      </div>

      {/* Color Selection */}
      <div className="space-y-1.5">
        <span className="text-[0.7rem] font-semibold text-tx-secondary block">
          Cor do Destaque:
        </span>
        <div className="flex items-center gap-2">
          {COLOR_CHOICES.map((c) => (
            <button
              key={c.hex}
              type="button"
              title={c.label}
              className={`h-6 w-6 rounded-full ${c.classBg} transition-all duration-150 cursor-pointer ${
                selectedColor === c.hex
                  ? 'ring-2 ring-brand ring-offset-2 ring-offset-surface scale-110 shadow-sm'
                  : 'hover:scale-105 opacity-80 hover:opacity-100'
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
          className="text-[0.7rem] font-semibold text-tx-secondary"
        >
          Sua Anotação:
        </label>
        <textarea
          id="note-draft-textarea"
          rows={4}
          value={noteContent}
          onChange={(e) => setNoteContent(e.target.value)}
          placeholder="Escreva suas reflexões, ideias ou dúvidas sobre esta passagem..."
          className="w-full rounded-xl border border-line-subtle bg-surface-subtle p-3 text-xs text-tx-main placeholder:text-tx-faint focus:border-brand focus:outline-none transition-colors"
        />
      </div>
    </Dialog>
  );
}
