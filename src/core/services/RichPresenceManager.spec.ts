import { describe, expect, it, vi } from 'vitest';
import { SpyPresenceProvider } from '../../test/fakes/SpyPresenceProvider';
import type { ReadingActivity } from '../ports/IPresenceProvider';
import { RichPresenceManager } from './RichPresenceManager';

const makeActivity = (page: number): ReadingActivity => ({
  bookHash: 'hash-symposium',
  bookTitle: 'Symposium',
  bookAuthor: 'Plato',
  chapterTitle: 'Diotima’s Speech',
  currentPage: page,
  totalPages: 120,
  percentage: Math.round((page / 120) * 100),
  state: 'reading',
  sessionStartedAt: new Date('2026-03-01T18:00:00Z'),
});

describe('RichPresenceManager', () => {
  it('debounces multiple updateActivity calls within 3000ms into a single dispatch', async () => {
    vi.useFakeTimers();

    const discordSpy = new SpyPresenceProvider('discord-ipc', 'Discord RPC');
    const webhookSpy = new SpyPresenceProvider('custom-webhook', 'Custom Webhook');

    const manager = new RichPresenceManager(3000);
    manager.registerProvider(discordSpy);
    manager.registerProvider(webhookSpy);

    manager.updateActivity(makeActivity(10));
    vi.advanceTimersByTime(1000);
    manager.updateActivity(makeActivity(11));
    vi.advanceTimersByTime(1500);
    manager.updateActivity(makeActivity(12));

    // Not yet 3000ms since last update
    vi.advanceTimersByTime(2900);
    expect(discordSpy.publishedActivities).toHaveLength(0);
    expect(webhookSpy.publishedActivities).toHaveLength(0);

    // Crosses 3000ms threshold after the last call
    await vi.advanceTimersByTimeAsync(150);

    expect(discordSpy.publishedActivities).toHaveLength(1);
    expect(discordSpy.publishedActivities[0].currentPage).toBe(12);
    expect(webhookSpy.publishedActivities).toHaveLength(1);
    expect(webhookSpy.publishedActivities[0].currentPage).toBe(12);

    vi.useRealTimers();
  });

  it('isolates provider failures using Promise.allSettled so remaining providers still update', async () => {
    vi.useFakeTimers();

    const failingProvider = new SpyPresenceProvider('failing-discord');
    failingProvider.shouldThrowOnPublish = true;

    const healthyWebhook = new SpyPresenceProvider('healthy-webhook');

    const manager = new RichPresenceManager(3000);
    manager.registerProvider(failingProvider);
    manager.registerProvider(healthyWebhook);

    manager.updateActivity(makeActivity(45));
    await vi.advanceTimersByTimeAsync(3000);

    expect(healthyWebhook.publishedActivities).toHaveLength(1);
    expect(healthyWebhook.publishedActivities[0].currentPage).toBe(45);

    vi.useRealTimers();
  });
});
