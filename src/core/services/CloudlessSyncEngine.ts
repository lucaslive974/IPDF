import type { IExportStrategy, IRemoteStorageProvider } from '../ports/IRemoteStorageProvider';
import type { DataPortabilityService } from './DataPortabilityService';

export class CloudlessSyncEngine {
  private static readonly LIBRARY_INDEX_FILE = '.reader_library_index.json';

  constructor(
    private readonly remoteStorage: IRemoteStorageProvider,
    private readonly portabilityService: DataPortabilityService,
    private readonly exportStrategy: IExportStrategy
  ) {}

  public async syncBookState(bookHash: string): Promise<void> {
    if (!this.remoteStorage.isAuthenticated()) {
      return;
    }

    const highlightsFileName = `${bookHash}.highlights.json`;
    const remoteEntry = await this.remoteStorage.findFileByName(highlightsFileName);

    if (remoteEntry) {
      const remoteBytes = await this.remoteStorage.downloadFile(remoteEntry.id);
      await this.portabilityService.importData(remoteBytes, this.exportStrategy, 'last-write-wins');
    }

    const mergedSerialized = await this.portabilityService.exportData(
      {
        bookHashes: [bookHash],
        includeBookFiles: false,
        format: 'json-only',
      },
      this.exportStrategy
    );

    await this.remoteStorage.uploadFile(highlightsFileName, mergedSerialized, 'application/json');
  }

  public async syncLibraryIndex(): Promise<void> {
    if (!this.remoteStorage.isAuthenticated()) {
      return;
    }

    const remoteIndex = await this.remoteStorage.findFileByName(
      CloudlessSyncEngine.LIBRARY_INDEX_FILE
    );

    if (remoteIndex) {
      const remoteBytes = await this.remoteStorage.downloadFile(remoteIndex.id);
      await this.portabilityService.importData(remoteBytes, this.exportStrategy, 'last-write-wins');
    }

    const updatedCatalog = await this.portabilityService.exportData(
      {
        includeBookFiles: false,
        format: 'json-only',
      },
      this.exportStrategy
    );

    await this.remoteStorage.uploadFile(
      CloudlessSyncEngine.LIBRARY_INDEX_FILE,
      updatedCatalog,
      'application/json'
    );
  }
}
