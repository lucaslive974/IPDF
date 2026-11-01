import { type ReactNode, memo, useEffect, useRef, useState } from 'react';
import { ChevronDownIcon } from './icons';

export interface FilterOption<T extends string = string> {
  readonly value: T;
  readonly label: string;
  readonly count?: number;
}

export interface FilterButtonProps<T extends string = string> {
  readonly label?: string;
  readonly value: T;
  readonly options: readonly FilterOption<T>[];
  readonly onChange: (value: T) => void;
  readonly icon?: ReactNode;
  readonly className?: string;
  readonly ariaLabel?: string;
}

export const FilterButton = memo(function FilterButton<T extends string = string>({
  label,
  value,
  options,
  onChange,
  icon,
  className = '',
  ariaLabel,
}: FilterButtonProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value) ?? options[0];

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      {/* Minimalist Trigger Button */}
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={ariaLabel ?? label ?? selectedOption?.label}
        onClick={() => setIsOpen((prev) => !prev)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg text-tx-secondary hover:text-tx-main hover:bg-surface-subtle transition cursor-pointer select-none"
      >
        {icon && <span className="shrink-0 text-tx-muted">{icon}</span>}
        {label && <span className="text-tx-muted">{label}</span>}
        <span className="font-medium text-tx-main truncate max-w-44">
          {selectedOption?.label ?? value}
        </span>
        <ChevronDownIcon
          className={`h-3.5 w-3.5 text-tx-muted transition-transform duration-150 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          role="menu"
          className="absolute left-0 mt-1 z-30 min-w-44 max-h-60 overflow-y-auto rounded-xl border border-line-subtle bg-surface/95 p-1 shadow-lg backdrop-blur-md transition-all duration-150"
        >
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                role="menuitem"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-xs text-left transition cursor-pointer ${
                  isSelected
                    ? 'bg-surface-subtle text-tx-main font-semibold'
                    : 'text-tx-secondary hover:bg-surface-subtle/80 hover:text-tx-main'
                }`}
              >
                <span className="truncate">{opt.label}</span>
                {typeof opt.count === 'number' && (
                  <span className="font-mono text-[0.68rem] text-tx-muted shrink-0">
                    ({opt.count})
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}) as <T extends string = string>(props: FilterButtonProps<T>) => React.JSX.Element;
