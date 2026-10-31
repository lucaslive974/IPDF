import type { ReactNode } from 'react';
import { IconButton } from './IconButton';
import { CloseIcon } from './icons';

export interface ModalProps {
  readonly isOpen: boolean;
  readonly title: ReactNode;
  readonly subtitle?: ReactNode;
  readonly onClose: () => void;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
  readonly maxWidth?: string;
}

export function Modal({
  isOpen,
  title,
  subtitle,
  onClose,
  children,
  footer,
  maxWidth = 'max-w-4xl',
}: ModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-4 transition-opacity duration-200">
      <div
        className={`relative flex h-[88vh] w-full ${maxWidth} flex-col rounded-xl border border-line-subtle bg-surface shadow-2xl overflow-hidden`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line-subtle bg-surface px-6 py-4 shrink-0">
          <div>
            <h3 className="text-base font-semibold text-tx-main tracking-tight">{title}</h3>
            {subtitle && <div className="mt-0.5 text-xs text-tx-muted">{subtitle}</div>}
          </div>
          <IconButton variant="ghost" size="xs" label="Close" onClick={onClose}>
            <CloseIcon className="h-4 w-4" />
          </IconButton>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="border-t border-line-subtle bg-surface-subtle/50 px-6 py-3 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
