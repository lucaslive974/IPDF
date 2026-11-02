import { type FormEvent, type KeyboardEvent, memo, useEffect, useState } from 'react';
import type { BookMetadata } from '../../../core/domain/BookMetadata';
import type { UpdateBookMetadataInput } from '../../../core/ports/ILibraryService';
import { useServiceContainer } from '../../providers/ServiceContainerContext';
import { Badge, Button, CloseIcon, Dialog, Input, PlusIcon } from '../ui';

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
  const { libraryService } = useServiceContainer();

  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [availableAuthors, setAvailableAuthors] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);

  useEffect(() => {
    if (book) {
      setTitle(book.title);
      setAuthor(book.author === 'Local File' || book.author === 'Unknown' ? '' : book.author);
      setDescription(book.description ?? '');
      setTags(book.tags ?? []);
      setTagInput('');
    }
  }, [book]);

  useEffect(() => {
    if (isOpen) {
      void libraryService
        .listAuthors()
        .then(setAvailableAuthors)
        .catch(() => {});
      void libraryService
        .listTags()
        .then(setAvailableTags)
        .catch(() => {});
    }
  }, [isOpen, libraryService]);

  if (!book) return null;

  const trimmedTitle = title.trim();
  const isValid = trimmedTitle.length > 0;

  const handleAddTag = (e?: React.MouseEvent | KeyboardEvent) => {
    e?.preventDefault();
    const candidate = tagInput.trim();
    if (!candidate) return;

    const alreadyExists = tags.some((t) => t.toLowerCase() === candidate.toLowerCase());
    if (!alreadyExists) {
      setTags([...tags, candidate]);
    }
    setTagInput('');
  };

  const handleTagInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddTag(e);
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!isValid || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSave(book.bookHash, {
        title: trimmedTitle,
        author: author.trim() || 'Unknown',
        tags,
        description: description.trim() || undefined,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

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
            onClick={() => void handleSubmit()}
            disabled={!isValid || isSubmitting}
          >
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </Button>
        </>
      }
    >
      <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
        {/* Title */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="edit-book-title" className="text-xs font-medium text-tx-secondary">
            Title <span className="text-red-500">*</span>
          </label>
          <Input
            id="edit-book-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Document title..."
            autoFocus
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
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="Author name (e.g., Plato, Marcus Aurelius)..."
          />
          <datalist id="authors-datalist">
            {availableAuthors.map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>
        </div>

        {/* Tags */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="edit-book-tags-input" className="text-xs font-medium text-tx-secondary">
            Tags & Collections
          </label>

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-1">
              {tags.map((tag) => (
                <Badge key={tag} variant="brand" size="xs" className="gap-1.5 pr-1">
                  <span>{tag}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="p-0.5 rounded-full hover:bg-surface-hover text-tx-muted hover:text-tx-main cursor-pointer transition"
                    aria-label={`Remove tag ${tag}`}
                  >
                    <CloseIcon className="h-2.5 w-2.5" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            <div className="flex-1">
              <Input
                id="edit-book-tags-input"
                list="tags-datalist"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagInputKeyDown}
                placeholder="Type tag and press Enter..."
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={handleAddTag}
              disabled={!tagInput.trim()}
              className="h-8 shrink-0"
            >
              <PlusIcon className="h-3 w-3 mr-1" />
              Add
            </Button>
          </div>
          <datalist id="tags-datalist">
            {availableTags
              .filter((t) => !tags.includes(t))
              .map((t) => (
                <option key={t} value={t} />
              ))}
          </datalist>
          <span className="text-[0.65rem] text-tx-muted">
            Unused tags will automatically be removed when deleted from all books.
          </span>
        </div>

        {/* Description */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="edit-book-description" className="text-xs font-medium text-tx-secondary">
            Description
          </label>
          <textarea
            id="edit-book-description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add notes, synopsis or additional context about this book..."
            className="w-full rounded-lg border border-line-subtle bg-surface-subtle/80 px-3 py-1.5 text-xs text-tx-main placeholder:text-tx-faint focus:border-line-strong focus:outline-none transition resize-y min-h-18"
          />
        </div>
      </form>
    </Dialog>
  );
});
