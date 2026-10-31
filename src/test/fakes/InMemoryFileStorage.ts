import type { BookFormat } from '../../core/domain/types';
import type { IFileStorageService } from '../../core/ports/ISystemBridge';

export class InMemoryFileStorage implements IFileStorageService {
  private readonly binaries = new Map<string, { data: ArrayBuffer; ext: BookFormat }>();

  public async readBookBinary(bookHash: string): Promise<ArrayBuffer> {
    const entry = this.binaries.get(bookHash);
    if (!entry) {
      throw new Error(`Binary not found for bookHash: ${bookHash}`);
    }
    return entry.data;
  }

  public async writeBookBinary(
    bookHash: string,
    data: ArrayBuffer,
    ext: BookFormat
  ): Promise<string> {
    this.binaries.set(bookHash, { data, ext });
    return `memory://books/${bookHash}.${ext}`;
  }

  public async hasBookBinary(bookHash: string): Promise<boolean> {
    return this.binaries.has(bookHash);
  }
}
