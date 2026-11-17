import type { BookMetadata } from '@domain/BookMetadata';
import type { Highlight } from '@domain/Highlight';
import type {
  BackupArtifact,
  BackupReport,
  CreateBackupResult,
  IBackupService,
} from '@ports/IBackupService';
import type { IHighlightService } from '@ports/IHighlightService';
import type { ILibraryService } from '@ports/ILibraryService';
import { useServiceContainer } from '@providers/ServiceContainerContext';
import { useHighlightStore } from '@stores/useHighlightStore';
import { useLibraryStore } from '@stores/useLibraryStore';
import { appLogger } from '@utils/logger';
import { useCallback, useEffect, useState } from 'react';

export function formatBackupSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

export function formatBackupReportSummary(prefix: string, report: BackupReport): string {
  const bookLabel = report.booksCount === 1 ? 'book' : 'books';
  const coverLabel = report.coversCount === 1 ? 'cover' : 'covers';
  return `${prefix}: ${report.booksCount} ${bookLabel}, ${report.coversCount} ${coverLabel} (${formatBackupSize(report.totalBytes)})`;
}

export async function executeCreateBackup(
  backupService: Pick<IBackupService, 'createLocalBackup'>
): Promise<CreateBackupResult> {
  return backupService.createLocalBackup();
}

export interface RestoreBackupDependencies {
  readonly backupId: string;
  readonly backupService: Pick<IBackupService, 'restoreLocalBackup'>;
  readonly libraryService: Pick<ILibraryService, 'listLibraryBooks'>;
  readonly highlightService: Pick<IHighlightService, 'loadAllHighlights'>;
  readonly setBooks: (books: readonly BookMetadata[]) => void;
  readonly setHighlights: (highlights: readonly Highlight[]) => void;
}

export async function executeRestoreBackup(deps: RestoreBackupDependencies): Promise<BackupReport> {
  const report = await deps.backupService.restoreLocalBackup(deps.backupId);
  const [books, highlights] = await Promise.all([
    deps.libraryService.listLibraryBooks(),
    deps.highlightService.loadAllHighlights(),
  ]);
  deps.setBooks(books);
  deps.setHighlights(highlights);
  return report;
}

export interface UseBackupReturn {
  readonly backups: readonly BackupArtifact[];
  readonly isLoading: boolean;
  readonly isCreating: boolean;
  readonly isRestoring: boolean;
  readonly pendingRestoreId: string | null;
  readonly statusMessage: string | null;
  readonly error: string | null;
  refreshBackups(): Promise<void>;
  createBackup(): Promise<void>;
  requestRestore(backupId: string): void;
  cancelRestore(): void;
  confirmRestore(backupId: string): Promise<void>;
  deleteBackup(backupId: string): Promise<void>;
}

export function useBackup(): UseBackupReturn {
  const { backupService, libraryService, highlightService } = useServiceContainer();
  const setBooks = useLibraryStore((s) => s.setBooks);
  const setHighlights = useHighlightStore((s) => s.setHighlights);

  const [backups, setBackups] = useState<readonly BackupArtifact[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [pendingRestoreId, setPendingRestoreId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshBackups = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await backupService.listLocalBackups();
      setBackups(list);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      appLogger.warn(`Failed to list local backups: ${msg}`, 'backup');
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [backupService]);

  useEffect(() => {
    void refreshBackups();
  }, [refreshBackups]);

  const createBackup = useCallback(async () => {
    setIsCreating(true);
    setError(null);
    setStatusMessage(null);
    try {
      const result = await executeCreateBackup(backupService);
      setStatusMessage(formatBackupReportSummary('Backup created', result.report));
      await refreshBackups();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      appLogger.error(`Failed to create local backup: ${msg}`, 'backup');
      setError(msg);
    } finally {
      setIsCreating(false);
    }
  }, [backupService, refreshBackups]);

  const requestRestore = useCallback((backupId: string) => {
    setPendingRestoreId(backupId);
    setError(null);
  }, []);

  const cancelRestore = useCallback(() => {
    setPendingRestoreId(null);
  }, []);

  const confirmRestore = useCallback(
    async (backupId: string) => {
      setIsRestoring(true);
      setError(null);
      setStatusMessage(null);
      try {
        const report = await executeRestoreBackup({
          backupId,
          backupService,
          libraryService,
          highlightService,
          setBooks,
          setHighlights,
        });
        setPendingRestoreId(null);
        setStatusMessage(formatBackupReportSummary('Backup restored', report));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        appLogger.error(`Failed to restore backup ${backupId}: ${msg}`, 'backup');
        setError(msg);
      } finally {
        setIsRestoring(false);
      }
    },
    [backupService, highlightService, libraryService, setBooks, setHighlights]
  );

  const deleteBackup = useCallback(
    async (backupId: string) => {
      setError(null);
      try {
        await backupService.deleteLocalBackup(backupId);
        if (pendingRestoreId === backupId) {
          setPendingRestoreId(null);
        }
        await refreshBackups();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        appLogger.error(`Failed to delete backup ${backupId}: ${msg}`, 'backup');
        setError(msg);
      }
    },
    [backupService, pendingRestoreId, refreshBackups]
  );

  return {
    backups,
    isLoading,
    isCreating,
    isRestoring,
    pendingRestoreId,
    statusMessage,
    error,
    refreshBackups,
    createBackup,
    requestRestore,
    cancelRestore,
    confirmRestore,
    deleteBackup,
  };
}
