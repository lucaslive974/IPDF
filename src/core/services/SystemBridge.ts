import type {
  IClipboardService,
  IFileStorageService,
  IMediaControlService,
  INotificationService,
  IPowerSaveBlocker,
} from '../ports/ISystemBridge';

export class SystemBridge {
  constructor(
    public readonly notifications: INotificationService,
    public readonly mediaSession: IMediaControlService,
    public readonly power: IPowerSaveBlocker,
    public readonly clipboard: IClipboardService,
    public readonly fileStorage: IFileStorageService
  ) {}
}
