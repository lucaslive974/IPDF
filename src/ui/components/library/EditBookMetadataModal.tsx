import { memo } from 'react';
import type { BookMetadata } from '../../../core/domain/BookMetadata';
import type { UpdateBookMetadataInput } from '../../../core/ports/ILibraryService';
import { useEditBookMetadataModal } from '../../hooks/useEditBookMetadataModal';
import { Button, Dialog, Input, TagInput, Textarea } from '../ui';

export interface EditBookMetadataModalProps {
  readonly isOpen: boolean;
  readonly book: BookMetadata | null;
  readonly onClose: () => void;
  readonly onSave: (bookHash: string, input: UpdateBookMetadataInput) => Promise<void> | void;
}

export const EditBookMetadataModal = memo(function EditBookMetadataModal({
  isOpen,
  book,
  onClose,
  onSave,
}: EditBookMetadataModalProps) {
  const {
    register,
    errors,
    isValid,
    isSubmitting,
    tags,
    availableAuthors,
    availableTags,
    addTag,
    removeTag,
    onSubmit,
  } = useEditBookMetadataModal({ book, isOpen, onSave, onClose });

  if (!book) return null;

  return (
    <Dialog
      isOpen={isOpen}
      title="Edit Book Details"
      subtitle="Update metadata, assign authors, organize tags, and edit book synopsis."
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => void onSubmit()}
            disabled={!isValid || isSubmitting}
          >
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void onSubmit();
        }}
        className="flex flex-col gap-4"
      >
        {/* Title */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="edit-book-title" className="text-xs font-medium text-tx-secondary">
            Title <span className="text-red-500">*</span>
          </label>
          <Input
            id="edit-book-title"
            placeholder="Document title..."
            error={errors.title?.message}
            autoFocus
            {...register('title', {
              required: 'Title is required',
              validate: (val) => Boolean(val.trim()) || 'Title cannot be blank',
            })}
          />
        </div>

        {/* Author */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="edit-book-author" className="text-xs font-medium text-tx-secondary">
            Author
          </label>
          <Input
            id="edit-book-author"
            list="authors-datalist"
            placeholder="Author name (e.g., Plato, Marcus Aurelius)..."
            {...register('author')}
          />
          {availableAuthors.length > 0 && (
            <datalist id="authors-datalist">
              {availableAuthors.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
          )}
        </div>

        {/* Tags */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="edit-book-tags" className="text-xs font-medium text-tx-secondary">
            Tags & Collections
          </label>
          <TagInput
            id="edit-book-tags"
            tags={tags}
            onAddTag={addTag}
            onRemoveTag={removeTag}
            suggestions={availableTags}
            disabled={isSubmitting}
          />
          <span className="text-[0.65rem] text-tx-muted">
            Unused tags will automatically be removed when deleted from all books.
          </span>
        </div>

        {/* Description */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="edit-book-description" className="text-xs font-medium text-tx-secondary">
            Description
          </label>
          <Textarea
            id="edit-book-description"
            rows={3}
            placeholder="Add notes, synopsis or additional context about this book..."
            {...register('description')}
          />
        </div>
      </form>
    </Dialog>
  );
});
