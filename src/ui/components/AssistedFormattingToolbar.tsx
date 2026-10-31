import type { TextFormatStyle } from '../../core/domain/types';

export interface FormattingActionItem {
  readonly id: string;
  readonly label: string;
  readonly style: TextFormatStyle;
}

const DEFAULT_FORMATTING_ACTIONS: FormattingActionItem[] = [
  { id: 'bold', label: 'B Bold', style: { kind: 'bold' } },
  { id: 'italic', label: 'I Italic', style: { kind: 'italic' } },
  { id: 'underline', label: 'U Underline', style: { kind: 'underline' } },
  { id: 'color-blue', label: 'Blue Text', style: { kind: 'textColor', colorHex: '#38bdf8' } },
  {
    id: 'bg-yellow',
    label: 'Mark Fill',
    style: { kind: 'backgroundColor', colorHex: '#ca8a04' },
  },
  { id: 'blockquote', label: '❝ Quote', style: { kind: 'blockquote' } },
];

export interface AssistedFormattingToolbarProps {
  readonly actions?: FormattingActionItem[];
  readonly onApplyFormat: (style: TextFormatStyle) => void;
}

export function AssistedFormattingToolbar({
  actions = DEFAULT_FORMATTING_ACTIONS,
  onApplyFormat,
}: AssistedFormattingToolbarProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          className="cursor-pointer rounded-md border border-slate-600 bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-100 transition hover:bg-slate-700"
          onClick={() => onApplyFormat(action.style)}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}
