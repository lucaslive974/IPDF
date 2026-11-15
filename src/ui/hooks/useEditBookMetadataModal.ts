import { isValidAuthor } from '@components/library/BookCover';
import type { BookMetadata } from '@domain/BookMetadata';
import type { UpdateBookMetadataInput } from '@ports/ILibraryService';
import { useServiceContainer } from '@providers/ServiceContainerContext';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useCoverBook } from './useCoverBook';

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

interface PendingCoverUpload {
  readonly bytes: Uint8Array;
  readonly mimeType: string;
  readonly previewUrl: string;
}

function revokePreviewUrl(url?: string | null): void {
  if (url && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
    URL.revokeObjectURL(url);
  }
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
  const [pendingCover, setPendingCover] = useState<PendingCoverUpload | null | undefined>(
    undefined
  );
  const pendingPreviewRef = useRef<string | null>(null);
  const { coverUrl: initialCoverUrl } = useCoverBook(
    isOpen && book ? book.bookHash : undefined,
    book?.format,
    book?.updatedAt.getTime()
  );
  const isCoverDirty = pendingCover !== undefined;
  const coverImageUrl =
    pendingCover === undefined ? initialCoverUrl : (pendingCover?.previewUrl ?? null);

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
      revokePreviewUrl(pendingPreviewRef.current);
      pendingPreviewRef.current = null;
      setPendingCover(undefined);
    }
    return () => {
      revokePreviewUrl(pendingPreviewRef.current);
      pendingPreviewRef.current = null;
    };
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
    const bytes = new Uint8Array(await file.arrayBuffer());
    const previewUrl =
      typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
        ? URL.createObjectURL(file)
        : '';
    revokePreviewUrl(pendingPreviewRef.current);
    pendingPreviewRef.current = previewUrl || null;
    setPendingCover({
      bytes,
      mimeType: file.type,
      previewUrl,
    });
  }, []);

  const handleRemoveCover = useCallback(() => {
    revokePreviewUrl(pendingPreviewRef.current);
    pendingPreviewRef.current = null;
    setPendingCover(null);
  }, []);

  const handleValidSubmit = useCallback(
    async (values: BookMetadataFormValues) => {
      if (!book) return;
      const payload = buildUpdateBookMetadataPayload(values, tags);
      if (!payload) return;

      if (pendingCover) {
        await libraryService.saveBookCover(
          book.bookHash,
          pendingCover.bytes,
          pendingCover.mimeType
        );
      } else if (pendingCover === null) {
        await libraryService.deleteBookCover(book.bookHash);
      }

      await onSave(book.bookHash, payload);
      onClose();
    },
    [book, onSave, onClose, tags, pendingCover, libraryService]
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
