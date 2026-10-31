import type { IExportStrategy, IStorageProvider } from '../ports/IStorageProvider';
import type { DataPortabilityService } from './DataPortabilityService';

export class CloudlessSyncEngine {
  private static readonly LIBRARY_INDEX_FILE = '.reader_library_index.json';

  constructor(
    private readonly storage: IStorageProvider,
    private readonly portabilityService: DataPortabilityService,
    private readonly exportStrategy: IExportStrategy
  ) {}

  public async syncBookState(bookHash: string): Promise<void> {
    if (!this.storage.isAvailable()) {
      return;
    }

    const highlightsFileName = `${bookHash}.highlights.json`;
    const existingBytes = await this.storage.readEntry(highlightsFileName);

    if (existingBytes) {
      await this.portabilityService.importData(
        existingBytes,
        this.exportStrategy,
        'last-write-wins'
      );
    }

    const mergedSerialized = await this.portabilityService.exportData(
      {
        bookHashes: [bookHash],
        includeBookFiles: false,
        format: 'json-only',
      },
      this.exportStrategy
    );

    await this.storage.writeEntry(highlightsFileName, mergedSerialized, 'application/json');
  }

  public async syncLibraryIndex(): Promise<void> {
    if (!this.storage.isAvailable()) {
      return;
    }

    const existingIndexBytes = await this.storage.readEntry(CloudlessSyncEngine.LIBRARY_INDEX_FILE);

    if (existingIndexBytes) {
      await this.portabilityService.importData(
        existingIndexBytes,
        this.exportStrategy,
        'last-write-wins'
      );
    }

    const updatedCatalog = await this.portabilityService.exportData(
      {
        includeBookFiles: false,
        format: 'json-only',
      },
      this.exportStrategy
    );

    await this.storage.writeEntry(
      CloudlessSyncEngine.LIBRARY_INDEX_FILE,
      updatedCatalog,
      'application/json'
    );
  }
}
