import type {
  IRemoteStorageProvider,
  RemoteFileEntry,
} from '../../src/core/ports/IRemoteStorageProvider';

interface StoredRemoteFile {
  entry: RemoteFileEntry;
  content: Uint8Array;
}

export class InMemoryRemoteStorageProvider implements IRemoteStorageProvider {
  public readonly providerId = 'in-memory-remote';
  private authenticated = true;
  private rootFolderId = 'root';
  private readonly filesByName = new Map<string, StoredRemoteFile>();
  private readonly filesById = new Map<string, StoredRemoteFile>();
  public uploadCount = 0;
  public downloadCount = 0;

  public setAuthenticated(state: boolean): void {
    this.authenticated = state;
  }

  public async authenticate(): Promise<boolean> {
    this.authenticated = true;
    return true;
  }

  public isAuthenticated(): boolean {
    return this.authenticated;
  }

  public async setRootFolder(folderId: string): Promise<void> {
    this.rootFolderId = folderId;
  }

  public getRootFolder(): string {
    return this.rootFolderId;
  }

  public async listFiles(_subfolder?: string): Promise<RemoteFileEntry[]> {
    return Array.from(this.filesByName.values()).map((f) => ({ ...f.entry }));
  }

  public async findFileByName(fileName: string): Promise<RemoteFileEntry | null> {
    const found = this.filesByName.get(fileName);
    return found ? { ...found.entry } : null;
  }

  public async downloadFile(
    remoteId: string,
    onProgress?: (pct: number) => void
  ): Promise<Uint8Array> {
    this.downloadCount++;
    const stored = this.filesById.get(remoteId);
    if (!stored) {
      throw new Error(`Remote file not found: ${remoteId}`);
    }
    onProgress?.(100);
    return new Uint8Array(stored.content);
  }

  public async uploadFile(
    fileName: string,
    data: Uint8Array | string,
    mimeType: string
  ): Promise<RemoteFileEntry> {
    this.uploadCount++;
    const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
    const existing = this.filesByName.get(fileName);
    const id = existing ? existing.entry.id : `remote-${this.filesByName.size + 1}`;

    const entry: RemoteFileEntry = {
      id,
      name: fileName,
      sizeBytes: bytes.byteLength,
      mimeType,
      modifiedAt: new Date(),
    };

    const record: StoredRemoteFile = { entry, content: bytes };
    this.filesByName.set(fileName, record);
    this.filesById.set(id, record);
    return { ...entry };
  }
}
