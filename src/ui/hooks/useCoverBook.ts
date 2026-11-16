import { BookFormat } from '@domain/types';
import { useServiceContainer } from '@providers/ServiceContainerContext';
import { appLogger } from '@utils/logger';
import { generateAndSavePdfCover } from '@utils/pdfCoverGenerator';
import { buildCoverProtocolUrl } from '@utils/protocols';
import { useCallback, useEffect, useState } from 'react';

export interface UseCoverBookResult {
  readonly coverUrl: string | null;
  readonly handleCoverError: () => void;
}

/**
 * Resolves a book cover through the native `cover://` protocol.
 * For PDFs without a persisted cover yet, lazily generates and saves page 1 on error.
 */
export function useCoverBook(
  bookHash?: string,
  format?: BookFormat,
  version?: number
): UseCoverBookResult {
  const { libraryService, readerService } = useServiceContainer();
  const [hasError, setHasError] = useState(false);
  const [hasAttemptedPdf, setHasAttemptedPdf] = useState(false);
  const [generatedVersion, setGeneratedVersion] = useState<number | undefined>(undefined);

  useEffect(() => {
    void bookHash;
    void version;
    setHasError(false);
    setHasAttemptedPdf(false);
    setGeneratedVersion(undefined);
  }, [bookHash, version]);

  const coverUrl =
    bookHash && !hasError ? buildCoverProtocolUrl(bookHash, generatedVersion ?? version) : null;

  const handleCoverError = useCallback(() => {
    setHasError(true);
    if (!bookHash || format !== BookFormat.PDF || hasAttemptedPdf) {
      return;
    }

    setHasAttemptedPdf(true);
    void generateAndSavePdfCover(bookHash, libraryService, readerService)
      .then((payload) => {
        if (payload) {
          setGeneratedVersion(Date.now());
          setHasError(false);
        }
      })
      .catch((err: unknown) => {
        appLogger.warn(
          `PDF cover generation failed for ${bookHash}; keeping placeholder: ${String(err)}`,
          'cover'
        );
      });
  }, [bookHash, format, hasAttemptedPdf, libraryService, readerService]);

  return { coverUrl, handleCoverError };
}
