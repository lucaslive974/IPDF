import type { HTMLAttributes, ReactNode } from 'react';

export type BadgeVariant = 'brand' | 'success' | 'warning' | 'neutral' | 'faint';
export type BadgeSize = 'xs' | 'sm';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  readonly variant?: BadgeVariant;
  readonly size?: BadgeSize;
  readonly children: ReactNode;
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  brand: 'border border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400',
  success: 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  warning: 'border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  neutral: 'border border-line-subtle bg-surface-subtle text-tx-secondary',
  faint: 'border border-line-subtle bg-transparent text-tx-faint',
};

const SIZE_CLASSES: Record<BadgeSize, string> = {
  xs: 'px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider rounded-full',
  sm: 'px-2.5 py-1 text-xs font-semibold rounded-full',
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
