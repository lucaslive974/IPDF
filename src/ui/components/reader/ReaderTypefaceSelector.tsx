import { FONT_FAMILY_DEFINITIONS, type FontFamilyChoice } from '@stores/useTypographyStore';
import { memo } from 'react';

export interface ReaderTypefaceSelectorProps {
  readonly fontFamily: FontFamilyChoice;
  readonly onSelectFontFamily: (family: FontFamilyChoice) => void;
  readonly options?: readonly FontFamilyChoice[];
}

const DEFAULT_FONT_OPTIONS: readonly FontFamilyChoice[] = [
  'serif',
  'sans',
  'editorial',
  'accessible',
  'mono',
];

export const ReaderTypefaceSelector = memo(function ReaderTypefaceSelector({
  fontFamily,
  onSelectFontFamily,
  options = DEFAULT_FONT_OPTIONS,
}: ReaderTypefaceSelectorProps) {
  return (
    <div className="flex flex-col gap-1.5 pt-1 border-t border-line-subtle/60">
      <span className="text-[0.65rem] uppercase tracking-wider font-medium text-tx-muted">
        Typeface
      </span>
      <div className="flex flex-col gap-1">
        {options.map((opt) => {
          const def = FONT_FAMILY_DEFINITIONS[opt];
          const isSelected = fontFamily === opt;
          return (
            <button
              key={opt}
              type="button"
              className={`flex items-center justify-between px-3 py-1.5 rounded-md text-xs transition cursor-pointer text-left ${
                isSelected
                  ? 'bg-surface text-tx-main shadow-2xs font-semibold border border-line-subtle/80'
                  : 'text-tx-secondary hover:bg-surface-subtle hover:text-tx-main'
              }`}
              style={{ fontFamily: def.cssFontFamily }}
              onClick={() => onSelectFontFamily(opt)}
            >
              <span>{def.label}</span>
              {isSelected && <span className="font-mono text-xs text-tx-main">&bull;</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
});
