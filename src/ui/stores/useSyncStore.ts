import type { BookAvailability, CloudSyncStatus } from '@core/ports/ISyncService';
import { create } from 'zustand';

export interface SyncStoreState {
  readonly status: CloudSyncStatus | null;
  readonly availabilities: Readonly<Record<string, BookAvailability>>;
  readonly downloadingHashes: Readonly<Record<string, boolean>>;
  readonly pendingAuthUrl: string | null;
  readonly isBusy: boolean;
  readonly error: string | null;

  setStatus: (status: CloudSyncStatus) => void;
  setAvailabilities: (availabilities: Record<string, BookAvailability>) => void;
  setBookDownloading: (bookHash: string, downloading: boolean) => void;
  setBookAvailability: (bookHash: string, availability: BookAvailability) => void;
  setPendingAuthUrl: (url: string | null) => void;
  setIsBusy: (busy: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  status: null,
  availabilities: {},
  downloadingHashes: {},
  pendingAuthUrl: null,
  isBusy: false,
  error: null,
};

export const useSyncStore = create<SyncStoreState>((set) => ({
  ...initialState,
  setStatus: (status) => set({ status }),
  setAvailabilities: (availabilities) => set({ availabilities }),
  setBookDownloading: (bookHash, downloading) =>
    set((prev) => ({
      downloadingHashes: { ...prev.downloadingHashes, [bookHash]: downloading },
    })),
  setBookAvailability: (bookHash, availability) =>
    set((prev) => ({
      availabilities: { ...prev.availabilities, [bookHash]: availability },
    })),
  setPendingAuthUrl: (pendingAuthUrl) => set({ pendingAuthUrl }),
  setIsBusy: (isBusy) => set({ isBusy }),
  setError: (error) => set({ error }),
  reset: () => set(initialState),
}));
