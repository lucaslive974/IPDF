import { memo } from 'react';

export interface SegmentedControlOption<T extends string = string> {
  readonly id: T;
  readonly label: string;
  readonly count?: number;
}

export interface SegmentedControlProps<T extends string = string> {
  readonly options: readonly SegmentedControlOption<T>[];
  readonly value: T;
  readonly onChange: (value: T) => void;
  readonly size?: 'sm' | 'md';
  readonly className?: string;
  readonly ariaLabel?: string;
}

export const SegmentedControl = memo(function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  size = 'sm',
  className = '',
  ariaLabel = 'Segmented options',
}: SegmentedControlProps<T>) {
  const sizeClasses = size === 'sm' ? 'p-0.5 text-xs' : 'p-1 text-sm';
  const buttonPadding = size === 'sm' ? 'px-3 py-1' : 'px-4 py-1.5';

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`inline-flex items-center gap-0.5 rounded-lg bg-surface-subtle/80 border border-line-subtle/60 font-medium ${sizeClasses} ${className}`}
    >
      {options.map((opt) => {
        const isSelected = opt.id === value;
        return (
          <button
            key={opt.id}
            role="tab"
            type="button"
            aria-selected={isSelected}
            tabIndex={isSelected ? 0 : -1}
            className={`${buttonPadding} rounded-md transition cursor-pointer select-none ${
              isSelected
                ? 'bg-surface text-tx-main shadow-2xs font-semibold'
                : 'text-tx-muted hover:text-tx-main'
            }`}
            onClick={() => onChange(opt.id)}
          >
            <span>{opt.label}</span>
            {typeof opt.count === 'number' && (
              <span
                className={`ml-1.5 font-mono text-[0.68rem] ${
                  isSelected ? 'text-tx-main' : 'text-tx-muted'
                }`}
              >
                ({opt.count})
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}) as <T extends string = string>(props: SegmentedControlProps<T>) => React.JSX.Element;
