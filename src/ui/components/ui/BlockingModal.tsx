import { memo } from 'react';
import { Card } from './Card';

export interface BlockingModalProps {
  readonly isOpen: boolean;
  readonly title: string;
  readonly message: string;
}

/**
 * Full-screen blocking modal for long-running operations where user interaction
 * must be prevented until completion (e.g., backup creation or restore).
 */
export const BlockingModal = memo(function BlockingModal({
  isOpen,
  title,
  message,
}: BlockingModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div role="dialog" aria-modal="true" aria-live="assertive" className="modal-backdrop z-50">
      <Card variant="surface" padding="md" className="w-full max-w-sm shadow-2xl">
        <div className="flex flex-col gap-2 text-center">
          <h3 className="text-sm font-semibold text-tx-main">{title}</h3>
          <p className="text-xs text-tx-secondary">{message}</p>
        </div>
      </Card>
    </div>
  );
});
