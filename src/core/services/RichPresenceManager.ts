import type { IPresenceProvider, ReadingActivity } from '../ports/IPresenceProvider';

export class RichPresenceManager {
  private readonly providers = new Map<string, IPresenceProvider>();
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly debounceMs = 3000) {}

  public registerProvider(provider: IPresenceProvider): void {
    this.providers.set(provider.id, provider);
  }

  public updateActivity(activity: ReadingActivity, immediate = false): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (immediate) {
      void this.dispatchToProviders(activity);
      return;
    }

    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      void this.dispatchToProviders(activity);
    }, this.debounceMs);
  }

  public async clearAllPresence(): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    const enabledProviders = Array.from(this.providers.values()).filter((p) => p.isEnabled);
    await Promise.allSettled(enabledProviders.map((provider) => provider.clearActivity()));
  }

  private async dispatchToProviders(activity: ReadingActivity): Promise<void> {
    const enabledProviders = Array.from(this.providers.values()).filter((p) => p.isEnabled);
    await Promise.allSettled(
      enabledProviders.map((provider) => provider.publishActivity(activity))
    );
  }
}
