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
          className="cursor-pointer rounded-md border border-line-subtle bg-surface-subtle px-2.5 py-1.5 text-xs font-medium text-tx-secondary transition hover:bg-surface-hover hover:text-tx-main"
          onClick={() => onApplyFormat(action.style)}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}
