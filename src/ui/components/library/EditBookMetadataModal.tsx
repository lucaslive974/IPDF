import { BookCover } from '@components/library/BookCover';
import type { BookMetadata } from '@domain/BookMetadata';
import { useEditBookMetadataModal } from '@hooks/useEditBookMetadataModal';
import type { UpdateBookMetadataInput } from '@ports/ILibraryService';
import {
  AutocompleteInput,
  Button,
  Dialog,
  Input,
  TagInput,
  Textarea,
  TrashIcon,
  UploadIcon,
} from '@ui';
import { memo, useRef } from 'react';

export interface EditBookMetadataModalProps {
  readonly isOpen: boolean;
  readonly book: BookMetadata | null;
  readonly onClose: () => void;
  readonly onSave: (
    bookHash: string,
    input: UpdateBookMetadataInput,
    coverImageUrl?: string
  ) => Promise<void> | void;
}

export const EditBookMetadataModal = memo(function EditBookMetadataModal({
  isOpen,
  book,
  onClose,
  onSave,
}: EditBookMetadataModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    setValue,
    errors,
    isValid,
    isSubmitting,
    tags,
    availableAuthors,
    availableTags,
    coverImageUrl,
    handleUploadCover,
    handleRemoveCover,
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
        {/* Cover Upload & Preview */}
        <div className="flex items-center gap-4 p-3 rounded-lg border border-line-subtle/60 bg-surface-subtle/40">
          <div className="relative shrink-0 w-20 aspect-3/4 rounded-md overflow-hidden bg-surface shadow-xs border border-line-subtle/70 flex items-center justify-center">
            {coverImageUrl ? (
              <img
                src={coverImageUrl}
                alt="Book cover preview"
                className="h-full w-full object-contain"
              />
            ) : (
              <BookCover
                title={book.title}
                author={book.author}
                className="w-full h-full pointer-events-none"
              />
            )}
          </div>

          <div className="flex flex-col gap-1.5 flex-1 min-w-0">
            <div>
              <span className="text-xs font-semibold text-tx-main block">Book Cover</span>
              <span className="text-[0.7rem] text-tx-muted block">
                Upload a custom cover image (PNG, JPG, or WebP).
              </span>
            </div>

            <div className="flex items-center gap-2 mt-1">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    void handleUploadCover(file);
                    e.target.value = '';
                  }
                }}
              />
              <Button
                type="button"
                variant="secondary"
                size="xs"
                onClick={() => fileInputRef.current?.click()}
                disabled={isSubmitting}
                iconLeft={<UploadIcon className="h-3.5 w-3.5" />}
              >
                {coverImageUrl ? 'Change Cover' : 'Upload Cover'}
              </Button>

              {coverImageUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={handleRemoveCover}
                  disabled={isSubmitting}
                  className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                  iconLeft={<TrashIcon className="h-3.5 w-3.5" />}
                >
                  Remove
                </Button>
              )}
            </div>
          </div>
        </div>

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
          <AutocompleteInput
            id="edit-book-author"
            placeholder="Author name (e.g., Plato, Marcus Aurelius)..."
            suggestions={availableAuthors}
            onSelectSuggestion={(selected) =>
              setValue('author', selected, { shouldDirty: true, shouldValidate: true })
            }
            {...register('author')}
          />
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
