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
    <div className="toolbar">
      {actions.map((action) => (
        <button key={action.id} type="button" onClick={() => onApplyFormat(action.style)}>
          {action.label}
        </button>
      ))}
    </div>
  );
}
