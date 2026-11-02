import type { Ref, TextareaHTMLAttributes } from 'react';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  readonly error?: string;
  readonly containerClassName?: string;
  readonly ref?: Ref<HTMLTextAreaElement>;
}

export function Textarea({
  error,
  containerClassName = '',
  className = '',
  rows = 3,
  ref,
  ...rest
}: TextareaProps) {
  return (
    <div className={`flex flex-col gap-1 ${containerClassName}`.trim()}>
      <textarea
        ref={ref}
        rows={rows}
        className={`w-full rounded-lg border bg-surface-subtle/80 px-3 py-1.5 text-xs text-tx-main placeholder:text-tx-faint focus:outline-none transition resize-y min-h-18 ${
          error
            ? 'border-red-500 focus:border-red-500'
            : 'border-line-subtle focus:border-line-strong'
        } ${className}`.trim()}
        {...rest}
      />
      {error && <span className="text-[0.65rem] text-red-500 font-medium px-1">{error}</span>}
    </div>
  );
}
