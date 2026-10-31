import { type FormEvent, memo, useEffect, useState } from 'react';
import type { BookMetadata } from '../../../core/domain/BookMetadata';
import { Button, Dialog, Input } from '../ui';

export interface RenameBookDialogProps {
  readonly isOpen: boolean;
  readonly book: BookMetadata | null;
  readonly onClose: () => void;
  readonly onRename: (bookHash: string, newTitle: string) => Promise<void> | void;
}

export const RenameBookDialog = memo(function RenameBookDialog({
  isOpen,
  book,
  onClose,
  onRename,
}: RenameBookDialogProps) {
  const [newTitle, setNewTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (book) {
      setNewTitle(book.title);
    }
  }, [book]);

  if (!book) return null;

  const trimmed = newTitle.trim();
  const isValid = trimmed.length > 0;

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!isValid || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onRename(book.bookHash, trimmed);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      title="Rename Document"
      subtitle="Update document title while keeping all annotations and reading progress intact."
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => void handleSubmit()}
            disabled={!isValid || isSubmitting}
          >
            {isSubmitting ? 'Saving...' : 'Save Title'}
          </Button>
        </>
      }
    >
      <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="rename-book-input" className="text-xs font-medium text-tx-secondary">
            Title
          </label>
          <Input
            id="rename-book-input"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Enter new book title..."
            autoFocus
          />
        </div>
      </form>
    </Dialog>
  );
});
