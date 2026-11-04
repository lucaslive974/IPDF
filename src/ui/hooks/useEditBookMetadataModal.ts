import { isValidAuthor } from '@components/library/BookCover';
import type { BookMetadata } from '@domain/BookMetadata';
import type { UpdateBookMetadataInput } from '@ports/ILibraryService';
import { useServiceContainer } from '@providers/ServiceContainerContext';
import { readFileAsDataUrl } from '@utils/fileReader';
import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

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
  readonly onSave: (
    bookHash: string,
    input: UpdateBookMetadataInput,
    coverImageUrl?: string
  ) => Promise<void> | void;
  readonly onClose: () => void;
}

export interface EditBookMetadataModalViewModel {
  readonly register: ReturnType<typeof useForm<BookMetadataFormValues>>['register'];
  readonly setValue: ReturnType<typeof useForm<BookMetadataFormValues>>['setValue'];
  readonly errors: ReturnType<typeof useForm<BookMetadataFormValues>>['formState']['errors'];
  readonly isValid: boolean;
  readonly isSubmitting: boolean;
  readonly tags: readonly string[];
  readonly availableAuthors: readonly string[];
  readonly availableTags: readonly string[];
  readonly addTag: (tag: string) => void;
  readonly removeTag: (tag: string) => void;
  readonly coverImageUrl: string | null;
  readonly isCoverDirty: boolean;
  readonly handleUploadCover: (file: File) => Promise<void>;
  readonly handleRemoveCover: () => void;
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
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [isCoverDirty, setIsCoverDirty] = useState(false);

  const {
    register,
    setValue,
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
      setCoverImageUrl(book.coverImageUrl ?? null);
      setIsCoverDirty(false);
    }
  }, [book, isOpen, reset]);

  useEffect(() => {
    if (isOpen) {
      void libraryService
        .listAuthors()
        .then((authors) => setAvailableAuthors(authors.filter(isValidAuthor)))
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

  const handleUploadCover = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      return;
    }
    const dataUrl = await readFileAsDataUrl(file);
    setCoverImageUrl(dataUrl);
    setIsCoverDirty(true);
  }, []);

  const handleRemoveCover = useCallback(() => {
    setCoverImageUrl(null);
    setIsCoverDirty(true);
  }, []);

  const handleValidSubmit = useCallback(
    async (values: BookMetadataFormValues) => {
      if (!book) return;
      const payload = buildUpdateBookMetadataPayload(values, tags);
      if (!payload) return;

      const coverToSave = isCoverDirty ? (coverImageUrl ?? '') : undefined;
      await onSave(book.bookHash, payload, coverToSave);
      onClose();
    },
    [book, onSave, onClose, tags, isCoverDirty, coverImageUrl]
  );

  const onSubmit = useCallback(
    () => handleSubmit(handleValidSubmit)(),
    [handleSubmit, handleValidSubmit]
  );

  return {
    register,
    setValue,
    errors,
    isValid,
    isSubmitting,
    tags,
    availableAuthors,
    availableTags,
    addTag,
    removeTag,
    coverImageUrl,
    isCoverDirty,
    handleUploadCover,
    handleRemoveCover,
    onSubmit,
  };
}
