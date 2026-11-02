import type { InputHTMLAttributes, ReactNode, Ref } from 'react';
import { CloseIcon } from './icons';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  readonly iconLeft?: ReactNode;
  readonly onClear?: () => void;
  readonly error?: string;
  readonly containerClassName?: string;
  readonly ref?: Ref<HTMLInputElement>;
}

export function Input({
  iconLeft,
  onClear,
  error,
  value,
  containerClassName = '',
  className = '',
  ref,
  ...rest
}: InputProps) {
  const hasValue = Boolean(value && String(value).length > 0);

  return (
    <div className={`flex flex-col gap-1 ${containerClassName}`.trim()}>
      <div
        className={`flex items-center rounded-lg border bg-surface-subtle/80 px-3 py-1.5 transition ${
          error
            ? 'border-red-500 focus-within:border-red-500'
            : 'border-line-subtle focus-within:border-line-strong'
        }`}
      >
        {iconLeft && <span className="mr-2 text-tx-muted shrink-0">{iconLeft}</span>}
        <input
          ref={ref}
          value={value}
          className={`w-full bg-transparent text-xs text-tx-main placeholder:text-tx-faint focus:outline-none ${className}`.trim()}
          {...rest}
        />
        {onClear && hasValue && (
          <button
            type="button"
            className="ml-1 p-0.5 text-tx-faint hover:text-tx-main cursor-pointer"
            onClick={onClear}
            aria-label="Clear input"
          >
            <CloseIcon className="h-3 w-3" />
          </button>
        )}
      </div>
      {error && <span className="text-[0.65rem] text-red-500 font-medium px-1">{error}</span>}
    </div>
  );
}
