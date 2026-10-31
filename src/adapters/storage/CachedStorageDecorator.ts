import type { BookFormat } from '../../core/domain/types';
import type { IStorageProvider, StorageEntry } from '../../core/ports/IStorageProvider';

export class CachedStorageDecorator implements IStorageProvider {
  public readonly providerId: string;

  constructor(
    private readonly localCache: IStorageProvider,
    private readonly primaryStorage: IStorageProvider,
    private readonly defaultFormat: BookFormat = 'epub'
  ) {
    this.providerId = `cached:${primaryStorage.providerId}`;
  }

  public async initialize(): Promise<boolean> {
    await this.localCache.initialize();
    return this.primaryStorage.initialize();
  }

  public isAvailable(): boolean {
    return this.primaryStorage.isAvailable() || this.localCache.isAvailable();
  }

  public async hasBookBinary(bookHash: string): Promise<boolean> {
    if (await this.localCache.hasBookBinary(bookHash)) {
      return true;
    }
    if (this.primaryStorage.isAvailable()) {
      return this.primaryStorage.hasBookBinary(bookHash);
    }
    return false;
  }

  public async readBookBinary(
    bookHash: string,
    onProgress?: (pct: number) => void
  ): Promise<ArrayBuffer> {
    if (await this.localCache.hasBookBinary(bookHash)) {
      onProgress?.(100);
      return this.localCache.readBookBinary(bookHash, onProgress);
    }

    const binary = await this.primaryStorage.readBookBinary(bookHash, onProgress);
    await this.localCache.writeBookBinary(bookHash, binary, this.defaultFormat);
    return binary;
  }

  public async writeBookBinary(
    bookHash: string,
    data: ArrayBuffer,
    format: BookFormat
  ): Promise<void> {
    await this.localCache.writeBookBinary(bookHash, data, format);
    if (this.primaryStorage.isAvailable()) {
      await this.primaryStorage.writeBookBinary(bookHash, data, format);
    }
  }

  public async listEntries(prefix?: string): Promise<StorageEntry[]> {
    if (this.primaryStorage.isAvailable()) {
      return this.primaryStorage.listEntries(prefix);
    }
    return this.localCache.listEntries(prefix);
  }

  public async readEntry(name: string): Promise<Uint8Array | null> {
    if (this.primaryStorage.isAvailable()) {
      const remoteEntry = await this.primaryStorage.readEntry(name);
      if (remoteEntry) {
        await this.localCache.writeEntry(name, remoteEntry);
        return remoteEntry;
      }
    }
    return this.localCache.readEntry(name);
  }

  public async writeEntry(
    name: string,
    data: Uint8Array | string,
    mimeType?: string
  ): Promise<StorageEntry> {
    const localResult = await this.localCache.writeEntry(name, data, mimeType);
    if (this.primaryStorage.isAvailable()) {
      return this.primaryStorage.writeEntry(name, data, mimeType);
    }
    return localResult;
  }
}
