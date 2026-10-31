import { DropdownMenu, DropdownMenuHeader, DropdownMenuItem, DropdownMenuSeparator } from './ui';

export interface ReaderContextMenuProps {
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly isOpen: boolean;
  readonly onHighlightColor: (colorHex: string) => void;
  readonly onOpenNoteDialog: () => void;
  readonly onOpenExplainDialog: () => void;
  readonly onOpenTranslateDialog: () => void;
  readonly onCopyText: () => void;
  readonly onClose: () => void;
}

const COLOR_PRESETS = [
  { label: 'Amarelo', hex: '#eab308', classBg: 'bg-amber-400' },
  { label: 'Verde', hex: '#22c55e', classBg: 'bg-emerald-500' },
  { label: 'Azul', hex: '#38bdf8', classBg: 'bg-sky-400' },
  { label: 'Roxo', hex: '#a855f7', classBg: 'bg-purple-500' },
  { label: 'Rosa', hex: '#f43f5e', classBg: 'bg-rose-500' },
];

export function ReaderContextMenu({
  text,
  x,
  y,
  isOpen,
  onHighlightColor,
  onOpenNoteDialog,
  onOpenExplainDialog,
  onOpenTranslateDialog,
  onCopyText,
  onClose,
}: ReaderContextMenuProps) {
  return (
    <DropdownMenu x={x} y={y} isOpen={isOpen} onClose={onClose} width="w-64">
      {/* Quick Color Picker Header */}
      <DropdownMenuHeader title="Destacar / Grifar">
        <div className="flex items-center gap-1.5">
          {COLOR_PRESETS.map((c) => (
            <button
              key={c.hex}
              type="button"
              title={`Grifar com ${c.label}`}
              className={`h-4 w-4 rounded-full ${c.classBg} transition hover:scale-125 active:scale-95 cursor-pointer shadow-xs`}
              onClick={() => {
                onHighlightColor(c.hex);
                onClose();
              }}
            />
          ))}
        </div>
      </DropdownMenuHeader>

      <DropdownMenuSeparator />

      {/* Main Options */}
      <DropdownMenuItem
        icon="📝"
        label="Criar Nota..."
        description="Adicionar comentário e anotação"
        onClick={() => {
          onClose();
          onOpenNoteDialog();
        }}
      />

      <DropdownMenuItem
        icon="✨"
        label="Explicar com IA..."
        description="Análise e conceitos filosóficos"
        onClick={() => {
          onClose();
          onOpenExplainDialog();
        }}
      />

      <DropdownMenuItem
        icon="🌐"
        label="Traduzir..."
        description="Tradução contextual para outros idiomas"
        onClick={() => {
          onClose();
          onOpenTranslateDialog();
        }}
      />

      <DropdownMenuSeparator />

      <DropdownMenuItem
        icon="📋"
        label="Copiar Texto"
        shortcut="Ctrl+C"
        onClick={() => {
          onCopyText();
          onClose();
        }}
      />

      {/* Excerpt quote preview */}
      <div className="px-2.5 py-1.5 mt-0.5 border-t border-line-subtle/50 text-[0.65rem] text-tx-muted italic truncate">
        &ldquo;{text}&rdquo;
      </div>
    </DropdownMenu>
  );
}
