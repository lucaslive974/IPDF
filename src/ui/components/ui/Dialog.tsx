import { type ReactNode, useEffect, useRef } from 'react';
import { IconButton } from './IconButton';

export interface DialogProps {
  readonly isOpen: boolean;
  readonly title: ReactNode;
  readonly subtitle?: ReactNode;
  readonly onClose: () => void;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
  readonly maxWidth?: string;
}

export function Dialog({
  isOpen,
  title,
  subtitle,
  onClose,
  children,
  footer,
  maxWidth = 'max-w-md',
}: DialogProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 dark:bg-slate-950/80 backdrop-blur-xs p-4 transition-opacity duration-150"
      onClick={(e) => {
        if (contentRef.current && !contentRef.current.contains(e.target as Node)) {
          onClose();
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          onClose();
        }
      }}
    >
      <div
        ref={contentRef}
        className={`relative flex w-full ${maxWidth} flex-col rounded-2xl border border-line-subtle bg-surface shadow-2xl overflow-hidden transition-all duration-200`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line-subtle bg-surface/90 px-5 py-3.5 shrink-0">
          <div>
            <h3 className="text-sm font-bold text-tx-main">{title}</h3>
            {subtitle && <p className="mt-0.5 text-xs text-tx-muted">{subtitle}</p>}
          </div>
          <IconButton variant="subtle" size="sm" label="Close Dialog" onClick={onClose}>
            ✕
          </IconButton>
        </div>

        {/* Content */}
        <div className="max-h-[70vh] overflow-y-auto p-5 text-tx-secondary text-xs leading-relaxed space-y-4">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="border-t border-line-subtle bg-surface-subtle/50 px-5 py-3 shrink-0 flex items-center justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
