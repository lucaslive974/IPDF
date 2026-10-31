import type { IPresenceProvider, ReadingActivity } from '../../src/core/ports/IPresenceProvider';

export class SpyPresenceProvider implements IPresenceProvider {
  public isEnabled = true;
  public connected = false;
  public publishedActivities: ReadingActivity[] = [];
  public clearCalls = 0;
  public shouldThrowOnPublish = false;

  constructor(
    public readonly id: string,
    public readonly name: string = id
  ) {}

  public async connect(): Promise<void> {
    this.connected = true;
  }

  public async publishActivity(activity: ReadingActivity): Promise<void> {
    if (this.shouldThrowOnPublish) {
      throw new Error(`Provider ${this.id} failed to publish activity`);
    }
    this.publishedActivities.push(activity);
  }

  public async clearActivity(): Promise<void> {
    this.clearCalls++;
  }

  public async disconnect(): Promise<void> {
    this.connected = false;
  }
}
