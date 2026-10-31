import type { HTMLAttributes, ReactNode } from 'react';

export type BadgeVariant = 'brand' | 'success' | 'warning' | 'neutral' | 'faint';
export type BadgeSize = 'xs' | 'sm';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  readonly variant?: BadgeVariant;
  readonly size?: BadgeSize;
  readonly children: ReactNode;
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  brand: 'border border-line-strong bg-surface-subtle text-tx-main',
  success: 'border border-emerald-600/20 bg-emerald-600/10 text-emerald-700 dark:text-emerald-300',
  warning: 'border border-amber-600/20 bg-amber-600/10 text-amber-700 dark:text-amber-300',
  neutral: 'border border-line-subtle bg-surface-subtle/70 text-tx-secondary',
  faint: 'border border-line-subtle/60 bg-transparent text-tx-muted',
};

const SIZE_CLASSES: Record<BadgeSize, string> = {
  xs: 'px-2 py-0.5 text-[0.65rem] font-medium tracking-wide rounded-full',
  sm: 'px-2.5 py-0.5 text-xs font-medium rounded-full',
};

export function Badge({
  variant = 'neutral',
  size = 'xs',
  className = '',
  children,
  ...rest
}: BadgeProps) {
  const variantClass = VARIANT_CLASSES[variant];
  const sizeClass = SIZE_CLASSES[size];

  return (
    <span
      className={`inline-flex items-center gap-1 shrink-0 ${sizeClass} ${variantClass} ${className}`.trim()}
      {...rest}
    >
      {children}
    </span>
  );
}
