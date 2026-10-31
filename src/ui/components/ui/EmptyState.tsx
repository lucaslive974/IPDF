import type { ReactNode } from 'react';
import { memo } from 'react';
import { Card } from './Card';

export interface EmptyStateProps {
  readonly icon?: ReactNode;
  readonly title: string;
  readonly description?: string;
  readonly action?: ReactNode;
  readonly className?: string;
}

export const EmptyState = memo(function EmptyState({
  icon,
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <Card
      variant="dashed"
      padding="lg"
      className={`flex flex-col items-center justify-center text-center py-12 px-6 ${className}`}
    >
      {icon && <div className="mb-3 text-tx-faint">{icon}</div>}
      <h3 className="text-xs font-semibold text-tx-main tracking-tight">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-xs text-tx-muted leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </Card>
  );
});
