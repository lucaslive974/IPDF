import { memo } from 'react';
import type { BookMetadata } from '../../../core/domain/BookMetadata';
import { EditBookMetadataModal } from './EditBookMetadataModal';

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
  return (
    <EditBookMetadataModal
      isOpen={isOpen}
      book={book}
      onClose={onClose}
      onSave={async (hash, input) => {
        await onRename(hash, input.title);
      }}
    />
  );
});
