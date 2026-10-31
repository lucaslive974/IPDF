import type { BookMetadata } from '../domain/BookMetadata';
import type { Highlight } from '../domain/Highlight';
import type { BookFormat } from '../domain/types';

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

export interface StorageEntry {
  name: string;
  sizeBytes: number;
  mimeType: string;
  modifiedAt: Date;
}

export interface IStorageProvider {
  readonly providerId: string;

  initialize(): Promise<boolean>;
  isAvailable(): boolean;

  hasBookBinary(bookHash: string): Promise<boolean>;
  readBookBinary(bookHash: string, onProgress?: (pct: number) => void): Promise<ArrayBuffer>;
  writeBookBinary(bookHash: string, data: ArrayBuffer, format: BookFormat): Promise<void>;

  listEntries(prefix?: string): Promise<StorageEntry[]>;
  readEntry(name: string): Promise<Uint8Array | null>;
  writeEntry(name: string, data: Uint8Array | string, mimeType?: string): Promise<StorageEntry>;
}
