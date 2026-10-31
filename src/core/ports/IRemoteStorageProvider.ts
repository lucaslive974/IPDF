import type { BookMetadata } from '../domain/BookMetadata';
import type { Highlight } from '../domain/Highlight';

export interface SyncPayload {
  schemaVersion: number;
  exportedAt: Date;
  deviceId: string;
  books: BookMetadata[];
  highlights: Highlight[];
  deletedIds?: string[];
  binaries?: Map<string, ArrayBuffer>;
}

export interface ExportOptions {
  bookHashes?: string[];
  includeBookFiles: boolean;
  format: 'zip-bundle' | 'json-only' | 'markdown';
}

export type ConflictResolution = 'last-write-wins' | 'keep-local' | 'keep-imported';

export interface ImportReport {
  booksImported: number;
  booksUpdated: number;
  highlightsAdded: number;
  highlightsUpdated: number;
  binariesRestored: number;
  conflictsResolved: number;
}

export interface IExportStrategy {
  serialize(payload: SyncPayload): Promise<Uint8Array | string>;
  deserialize(raw: Uint8Array | string): Promise<SyncPayload>;
}

export interface RemoteFileEntry {
  id: string;
  name: string;
  sizeBytes: number;
  mimeType: string;
  modifiedAt: Date;
}

export interface IRemoteStorageProvider {
  readonly providerId: string;
  authenticate(): Promise<boolean>;
  isAuthenticated(): boolean;
  setRootFolder(folderId: string): Promise<void>;
  listFiles(subfolder?: string): Promise<RemoteFileEntry[]>;
  findFileByName(fileName: string): Promise<RemoteFileEntry | null>;
  downloadFile(remoteId: string, onProgress?: (pct: number) => void): Promise<Uint8Array>;
  uploadFile(
    fileName: string,
    data: Uint8Array | string,
    mimeType: string
  ): Promise<RemoteFileEntry>;
}
