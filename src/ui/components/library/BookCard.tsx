import type { BookMetadata } from '@domain/BookMetadata';
import type { BookAvailability } from '@ports/ISyncService';
import { useSyncStore } from '@stores/useSyncStore';
import {
  Badge,
  Card,
  CheckIcon,
  CloudIcon,
  CloudOffIcon,
  IconButton,
  PencilIcon,
  ProgressBar,
  TrashIcon,
} from '@ui';
import { memo } from 'react';
import { BookCover, isValidAuthor } from './BookCover';

export interface BookCardCloudState {
  readonly availability?: BookAvailability;
  readonly isDownloading?: boolean;
  readonly isCloudConnected?: boolean;
}

export interface BookCardProps {
  readonly book: BookMetadata;
  readonly onOpenBook: (book: BookMetadata) => void;
  readonly onRenameBook?: (book: BookMetadata) => void;
  readonly onDeleteBook?: (book: BookMetadata) => void;
  readonly onEvictBook?: (book: BookMetadata) => void;
  readonly cloudState?: BookCardCloudState;
}

function BookCardCloudBadge({ isDownloading }: { readonly isDownloading: boolean }) {
  const label = isDownloading ? 'Downloading...' : 'Cloud';
  return (
    <div className="absolute bottom-2 left-2 pointer-events-none">
      <span
        data-testid="book-cloud-badge"
        aria-label={label}
        title={label}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[0.6rem] font-semibold tracking-wider uppercase text-tx-secondary cover-overlay-chip shadow-2xs"
      >
        <CloudIcon className={`h-3 w-3 shrink-0 ${isDownloading ? 'animate-pulse' : ''}`} />
        <span className="hidden sm:inline">{label}</span>
      </span>
    </div>
  );
}

interface BookCardQuickActionsProps {
  readonly book: BookMetadata;
  readonly canEvictLocal: boolean;
  readonly onEvictBook?: (book: BookMetadata) => void;
  readonly onRenameBook?: (book: BookMetadata) => void;
  readonly onDeleteBook?: (book: BookMetadata) => void;
}

function BookCardQuickActions({
  book,
  canEvictLocal,
  onEvictBook,
  onRenameBook,
  onDeleteBook,
}: BookCardQuickActionsProps) {
  if (!onRenameBook && !onDeleteBook && !canEvictLocal) {
    return null;
  }

  return (
    <div className="absolute top-2 right-2 flex items-center gap-1 hover-reveal transition-opacity duration-150 p-0.5 rounded-md cover-overlay-chip shadow-xs">
      {canEvictLocal && onEvictBook && (
        <IconButton
          variant="ghost"
          size="xs"
          label="Remove local download"
          className="text-tx-muted hover:text-tx-main"
          onClick={(e) => {
            e.stopPropagation();
            onEvictBook(book);
          }}
        >
          <CloudOffIcon className="h-3.5 w-3.5" />
        </IconButton>
      )}
      {onRenameBook && (
        <IconButton
          variant="ghost"
          size="xs"
          label="Edit details"
          className="text-tx-muted hover:text-tx-main"
          onClick={(e) => {
            e.stopPropagation();
            onRenameBook(book);
          }}
        >
          <PencilIcon className="h-3.5 w-3.5" />
        </IconButton>
      )}
      {onDeleteBook && (
        <IconButton
          variant="ghost"
          size="xs"
          label="Delete document"
          className="text-tx-muted hover:text-red-500 hover:bg-red-500/10"
          onClick={(e) => {
            e.stopPropagation();
            onDeleteBook(book);
          }}
        >
          <TrashIcon className="h-3.5 w-3.5" />
        </IconButton>
      )}
    </div>
  );
}

function BookCardMetadata({ book }: { readonly book: BookMetadata }) {
  const showAuthor = isValidAuthor(book.author);

  return (
    <div className="flex flex-col gap-1 px-0.5">
      <h3 className="text-xs font-semibold text-tx-main group-hover:text-tx-secondary transition-colors line-clamp-2 leading-snug">
        {book.title}
      </h3>

      {showAuthor && (
        <p className="text-[0.72rem] text-tx-muted font-normal line-clamp-1">{book.author}</p>
      )}

      {book.tags && book.tags.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {book.tags.slice(0, 2).map((tag) => (
            <Badge key={tag} variant="faint" size="xs">
              {tag}
            </Badge>
          ))}
          {book.tags.length > 2 && (
            <span className="text-[0.62rem] text-tx-muted self-center">
              +{book.tags.length - 2}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function BookCardProgressFooter({ book }: { readonly book: BookMetadata }) {
  const isCompleted = book.percentage >= 100;
  const isStarted = !isCompleted && (book.currentPage > 1 || book.percentage > 1);
  const roundedPercentage = Math.round(book.percentage);

  if (isCompleted) {
    return (
      <div className="mt-3 pt-2 border-t border-line-subtle/50 px-0.5">
        <div className="flex items-center gap-1.5 text-[0.68rem] font-medium text-emerald-600 dark:text-emerald-400">
          <CheckIcon className="h-3.5 w-3.5" />
          <span>Completed</span>
        </div>
      </div>
    );
  }

  if (isStarted) {
    return (
      <div className="mt-3 pt-2 border-t border-line-subtle/50 px-0.5">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-[0.68rem] text-tx-muted">
            <span>
              Page {book.currentPage} of {book.totalPages}
            </span>
            <span className="font-mono font-medium text-tx-secondary">{roundedPercentage}%</span>
          </div>
          <ProgressBar progress={book.percentage} size="xs" />
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 pt-2 border-t border-line-subtle/50 px-0.5">
      <div className="flex items-center justify-between text-[0.68rem] text-tx-muted">
        <span>
          {book.totalPages} {book.totalPages === 1 ? 'page' : 'pages'}
        </span>
        <span className="text-[0.62rem] font-medium uppercase tracking-wider text-tx-faint">
          Unread
        </span>
      </div>
    </div>
  );
}

export const BookCard = memo(function BookCard({
  book,
  onOpenBook,
  onRenameBook,
  onDeleteBook,
  onEvictBook,
  cloudState,
}: BookCardProps) {
  const storeAvailability = useSyncStore((s) =>
    __ENABLE_CLOUD_SYNC__ ? s.availabilities[book.bookHash] : undefined
  );
  const storeDownloading = useSyncStore((s) =>
    __ENABLE_CLOUD_SYNC__ ? Boolean(s.downloadingHashes[book.bookHash]) : false
  );
  const storeConnected = useSyncStore((s) =>
    __ENABLE_CLOUD_SYNC__ ? Boolean(s.status?.connected) : false
  );

  const availability = cloudState?.availability ?? storeAvailability;
  const isDownloading = cloudState?.isDownloading ?? storeDownloading;
  const isCloudConnected = cloudState?.isCloudConnected ?? storeConnected;
  const showCloudBadge = __ENABLE_CLOUD_SYNC__ && (isDownloading || availability === 'remoteOnly');
  const canEvictLocal =
    __ENABLE_CLOUD_SYNC__ &&
    isCloudConnected &&
    availability === 'local' &&
    !isDownloading &&
    Boolean(onEvictBook);

  return (
    <Card
      variant="interactive"
      padding="sm"
      className="group flex flex-col justify-between overflow-hidden transition-all duration-200"
      onClick={() => onOpenBook(book)}
    >
      <div className="flex flex-col gap-2.5">
        <div className="relative w-full">
          <BookCover
            bookHash={book.bookHash}
            format={book.format}
            coverVersion={book.updatedAt.getTime()}
            title={book.title}
            author={book.author}
            onClick={() => onOpenBook(book)}
          />

          <div className="absolute top-2 left-2 pointer-events-none hover-reveal transition-opacity duration-150">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-sm text-[0.6rem] font-semibold tracking-wider uppercase text-tx-secondary cover-overlay-chip shadow-2xs">
              {book.format}
            </span>
          </div>

          {showCloudBadge && <BookCardCloudBadge isDownloading={isDownloading} />}

          <BookCardQuickActions
            book={book}
            canEvictLocal={canEvictLocal}
            onEvictBook={onEvictBook}
            onRenameBook={onRenameBook}
            onDeleteBook={onDeleteBook}
          />
        </div>

        <BookCardMetadata book={book} />
      </div>

      <BookCardProgressFooter book={book} />
    </Card>
  );
});
