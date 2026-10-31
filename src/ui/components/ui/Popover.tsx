import type { HTMLAttributes, ReactNode } from 'react';

export interface PopoverProps extends HTMLAttributes<HTMLDivElement> {
  readonly x: number;
  readonly y: number;
  readonly width?: string;
  readonly offsetY?: number;
  readonly children: ReactNode;
}

export function Popover({
  x,
  y,
  width = 'w-76',
  offsetY = 110,
  className = '',
  children,
  style,
  ...rest
}: PopoverProps) {
  return (
    <div
      className={`fixed z-50 flex ${width} -translate-x-1/2 flex-col gap-2.5 rounded-xl border border-line-subtle bg-surface/95 p-3.5 shadow-2xl backdrop-blur-md transition-all duration-200 ${className}`.trim()}
      style={{
        left: `${x}px`,
        top: `${Math.max(16, y - offsetY)}px`,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
