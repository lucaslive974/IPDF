import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { BookMetadata } from '../../core/domain/BookMetadata';
import type { UpdateBookMetadataInput } from '../../core/ports/ILibraryService';
import { useServiceContainer } from '../providers/ServiceContainerContext';

export interface BookMetadataFormValues {
  title: string;
  author: string;
  description: string;
}

export function normalizeAuthor(author?: string | null): string {
  if (!author) return '';
  const trimmed = author.trim();
  if (trimmed === 'Local File' || trimmed === 'Unknown' || trimmed === 'Unknown Author') {
    return '';
  }
  return trimmed;
}

export function addTagDeduplicated(existingTags: readonly string[], newTag: string): string[] {
  const candidate = newTag.trim();
  if (!candidate) return [...existingTags];
  const exists = existingTags.some((t) => t.toLowerCase() === candidate.toLowerCase());
  return exists ? [...existingTags] : [...existingTags, candidate];
}

export function buildUpdateBookMetadataPayload(
  values: BookMetadataFormValues,
  tags: readonly string[]
): UpdateBookMetadataInput | null {
  const trimmedTitle = values.title.trim();
  if (!trimmedTitle) return null;
  return {
    title: trimmedTitle,
    author: values.author.trim() || 'Unknown',
    tags: Array.from(tags),
    description: values.description.trim() || undefined,
  };
}

export interface UseEditBookMetadataModalProps {
  readonly book: BookMetadata | null;
  readonly isOpen: boolean;
  readonly onSave: (bookHash: string, input: UpdateBookMetadataInput) => Promise<void> | void;
  readonly onClose: () => void;
}

export interface EditBookMetadataModalViewModel {
  readonly register: ReturnType<typeof useForm<BookMetadataFormValues>>['register'];
  readonly errors: ReturnType<typeof useForm<BookMetadataFormValues>>['formState']['errors'];
  readonly isValid: boolean;
  readonly isSubmitting: boolean;
  readonly tags: readonly string[];
  readonly availableAuthors: readonly string[];
  readonly availableTags: readonly string[];
  readonly addTag: (tag: string) => void;
  readonly removeTag: (tag: string) => void;
  readonly onSubmit: () => Promise<void>;
}

export function useEditBookMetadataModal({
  book,
  isOpen,
  onSave,
  onClose,
}: UseEditBookMetadataModalProps): EditBookMetadataModalViewModel {
  const { libraryService } = useServiceContainer();

  const [tags, setTags] = useState<string[]>([]);
  const [availableAuthors, setAvailableAuthors] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isValid, isSubmitting },
  } = useForm<BookMetadataFormValues>({
    mode: 'onChange',
    defaultValues: {
      title: '',
      author: '',
      description: '',
    },
  });

  useEffect(() => {
    if (book && isOpen) {
      reset({
        title: book.title,
        author: normalizeAuthor(book.author),
        description: book.description ?? '',
      });
      setTags(book.tags ?? []);
    }
  }, [book, isOpen, reset]);

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

  const addTag = useCallback((tag: string) => {
    setTags((prev) => addTagDeduplicated(prev, tag));
  }, []);

  const removeTag = useCallback((tagToRemove: string) => {
    setTags((prev) => prev.filter((t) => t !== tagToRemove));
  }, []);

  const handleValidSubmit = useCallback(
    async (values: BookMetadataFormValues) => {
      if (!book) return;
      const payload = buildUpdateBookMetadataPayload(values, tags);
      if (!payload) return;

      await onSave(book.bookHash, payload);
      onClose();
    },
    [book, onSave, onClose, tags]
  );

  const onSubmit = useCallback(
    () => handleSubmit(handleValidSubmit)(),
    [handleSubmit, handleValidSubmit]
  );

  return {
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
  };
}
