import { memo, useState } from 'react';
import type { BookMetadata } from '../../../core/domain/BookMetadata';
import { Button, Dialog } from '../ui';

export interface DeleteBookDialogProps {
  readonly isOpen: boolean;
  readonly book: BookMetadata | null;
  readonly onClose: () => void;
  readonly onDelete: (bookHash: string) => Promise<void> | void;
}

export const DeleteBookDialog = memo(function DeleteBookDialog({
  isOpen,
  book,
  onClose,
  onDelete,
}: DeleteBookDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  if (!book) return null;

  const handleDelete = async () => {
    if (isDeleting) return;

    setIsDeleting(true);
    try {
      await onDelete(book.bookHash);
      onClose();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      title="Delete Document"
      subtitle="Permanently remove this book, its highlights, and all study notes."
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => void handleDelete()}
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete Document'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-xs leading-relaxed text-tx-secondary">
        <p>
          Are you sure you want to delete{' '}
          <span className="font-semibold text-tx-main">{book.title}</span>?
        </p>
        <p className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-red-600 dark:text-red-400">
          This action is permanent and cannot be undone. All persistent highlights, marginalia, and
          reading progress linked to this book hash will be wiped.
        </p>
      </div>
    </Dialog>
  );
});
