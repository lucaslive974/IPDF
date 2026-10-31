import type { BookFormat } from '../../src/core/domain/types';
import type { IStorageProvider, StorageEntry } from '../../src/core/ports/IStorageProvider';

interface StoredEntryRecord {
  entry: StorageEntry;
  content: Uint8Array;
}

export class InMemoryStorageProvider implements IStorageProvider {
  public readonly providerId: string;
  private available = true;
  private readonly binaries = new Map<string, { data: ArrayBuffer; format: BookFormat }>();
  private readonly entries = new Map<string, StoredEntryRecord>();
  public writeEntryCount = 0;
  public readEntryCount = 0;
  public readBinaryCount = 0;

  constructor(providerId = 'in-memory-storage') {
    this.providerId = providerId;
  }

  public setAvailable(state: boolean): void {
    this.available = state;
  }

  public async initialize(): Promise<boolean> {
    this.available = true;
    return true;
  }

  public isAvailable(): boolean {
    return this.available;
  }

  public async hasBookBinary(bookHash: string): Promise<boolean> {
    return this.binaries.has(bookHash);
  }

  public async readBookBinary(
    bookHash: string,
    onProgress?: (pct: number) => void
  ): Promise<ArrayBuffer> {
    this.readBinaryCount++;
    const found = this.binaries.get(bookHash);
    if (!found) {
      throw new Error(`Binary not found for bookHash: ${bookHash}`);
    }
    onProgress?.(100);
    return found.data;
  }

  public async writeBookBinary(
    bookHash: string,
    data: ArrayBuffer,
    format: BookFormat
  ): Promise<void> {
    this.binaries.set(bookHash, { data, format });
  }

  public async listEntries(prefix?: string): Promise<StorageEntry[]> {
    const all = Array.from(this.entries.values()).map((r) => ({ ...r.entry }));
    if (!prefix) {
      return all;
    }
    return all.filter((entry) => entry.name.startsWith(prefix));
  }

  public async readEntry(name: string): Promise<Uint8Array | null> {
    this.readEntryCount++;
    const record = this.entries.get(name);
    return record ? new Uint8Array(record.content) : null;
  }

  public async writeEntry(
    name: string,
    data: Uint8Array | string,
    mimeType = 'application/octet-stream'
  ): Promise<StorageEntry> {
    this.writeEntryCount++;
    const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
    const entry: StorageEntry = {
      name,
      sizeBytes: bytes.byteLength,
      mimeType,
      modifiedAt: new Date(),
    };
    this.entries.set(name, { entry, content: bytes });
    return { ...entry };
  }
}
