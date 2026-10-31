import type {
  IClipboardService,
  IMediaControlService,
  INotificationService,
  IPowerSaveBlocker,
} from '../ports/ISystemBridge';

export class SystemBridge {
  constructor(
    public readonly notifications: INotificationService,
    public readonly mediaSession: IMediaControlService,
    public readonly power: IPowerSaveBlocker,
    public readonly clipboard: IClipboardService
  ) {}
}
