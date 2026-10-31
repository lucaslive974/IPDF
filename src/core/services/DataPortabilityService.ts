import type { BookMetadata } from '../domain/BookMetadata';
import type { Highlight } from '../domain/Highlight';
import type {
  ConflictResolution,
  ExportOptions,
  IExportStrategy,
  ImportReport,
  SyncPayload,
} from '../ports/IRemoteStorageProvider';
import type { IBookRepository, IHighlightRepository } from '../ports/IRepository';
import type { IFileStorageService } from '../ports/ISystemBridge';

export class DataPortabilityService {
  constructor(
    private readonly bookRepo: IBookRepository,
    private readonly highlightRepo: IHighlightRepository,
    private readonly fileStorage: IFileStorageService,
    private readonly deviceId = 'default-device'
  ) {}

  public async exportData(
    options: ExportOptions,
    strategy: IExportStrategy
  ): Promise<Uint8Array | string> {
    const allBooks = await this.bookRepo.findAll();
    const targetBooks = options.bookHashes
      ? allBooks.filter((b) => options.bookHashes?.includes(b.bookHash))
      : allBooks;

    const highlights: Highlight[] = [];
    for (const book of targetBooks) {
      const bookHighlights = await this.highlightRepo.findByBook(book.bookHash);
      highlights.push(...bookHighlights);
    }

    // If bookHashes were passed for a book whose metadata isn't in bookRepo yet, still export its highlights
    if (options.bookHashes) {
      const coveredHashes = new Set(targetBooks.map((b) => b.bookHash));
      for (const hash of options.bookHashes) {
        if (!coveredHashes.has(hash)) {
          const orphanHighlights = await this.highlightRepo.findByBook(hash);
          highlights.push(...orphanHighlights);
        }
      }
    }

    let binaries: Map<string, ArrayBuffer> | undefined;
    if (options.includeBookFiles) {
      binaries = new Map<string, ArrayBuffer>();
      for (const book of targetBooks) {
        if (await this.fileStorage.hasBookBinary(book.bookHash)) {
          const binary = await this.fileStorage.readBookBinary(book.bookHash);
          binaries.set(book.bookHash, binary);
        }
      }
    }

    const payload: SyncPayload = {
      schemaVersion: 1,
      exportedAt: new Date(),
      deviceId: this.deviceId,
      books: targetBooks,
      highlights,
      binaries,
    };

    return strategy.serialize(payload);
  }

  public async importData(
    raw: Uint8Array | string,
    strategy: IExportStrategy,
    rule: ConflictResolution = 'last-write-wins'
  ): Promise<ImportReport> {
    const payload = await strategy.deserialize(raw);
    const report: ImportReport = {
      booksImported: 0,
      booksUpdated: 0,
      highlightsAdded: 0,
      highlightsUpdated: 0,
      binariesRestored: 0,
      conflictsResolved: 0,
    };

    for (const incomingBook of payload.books) {
      const existingBook = await this.bookRepo.findById(incomingBook.bookHash);
      if (!existingBook) {
        await this.bookRepo.save(incomingBook);
        report.booksImported++;
      } else {
        report.conflictsResolved++;
        if (this.shouldOverwrite(existingBook.updatedAt, incomingBook.updatedAt, rule)) {
          await this.bookRepo.update(incomingBook);
          report.booksUpdated++;
        }
      }
    }

    for (const incomingHighlight of payload.highlights) {
      const existingHighlight = await this.highlightRepo.findById(incomingHighlight.id);
      if (!existingHighlight) {
        await this.highlightRepo.save(incomingHighlight);
        report.highlightsAdded++;
      } else {
        report.conflictsResolved++;
        if (this.shouldOverwrite(existingHighlight.updatedAt, incomingHighlight.updatedAt, rule)) {
          await this.highlightRepo.update(incomingHighlight);
          report.highlightsUpdated++;
        }
      }
    }

    if (payload.binaries) {
      const formatByHash = new Map<string, BookMetadata['format']>();
      for (const b of payload.books) {
        formatByHash.set(b.bookHash, b.format);
      }

      for (const [bookHash, binaryData] of payload.binaries.entries()) {
        const alreadyExists = await this.fileStorage.hasBookBinary(bookHash);
        if (!alreadyExists) {
          const localBook = await this.bookRepo.findById(bookHash);
          const ext = formatByHash.get(bookHash) ?? localBook?.format ?? 'epub';
          await this.fileStorage.writeBookBinary(bookHash, binaryData, ext);
          report.binariesRestored++;
        }
      }
    }

    return report;
  }

  private shouldOverwrite(
    localUpdatedAt: Date,
    incomingUpdatedAt: Date,
    rule: ConflictResolution
  ): boolean {
    if (rule === 'keep-local') {
      return false;
    }
    if (rule === 'keep-imported') {
      return true;
    }
    return incomingUpdatedAt.getTime() > localUpdatedAt.getTime();
  }
}
