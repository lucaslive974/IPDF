import { useCloudSyncListener } from '@hooks/useCloudSync';
import type { CloudSyncState } from '@ports/ISyncService';
import { useSyncStore } from '@stores/useSyncStore';
import { CheckIcon, CloudIcon } from '@ui';
import { hasDocument } from '@utils/dom';
import { memo, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type BadgePhase = 'hidden' | 'syncing' | 'synced' | 'error';

export function resolveSyncBadgePhase(
  state: CloudSyncState | undefined,
  wasSyncing: boolean
): BadgePhase {
  if (state === 'syncing') return 'syncing';
  if (wasSyncing && state === 'synced') return 'synced';
  if (wasSyncing && state === 'error') return 'error';
  return 'hidden';
}

export const CloudSyncOverlay = memo(function CloudSyncOverlay() {
  useCloudSyncListener();

  const connected = useSyncStore((s) => s.status?.connected ?? false);
  const syncState = useSyncStore((s) => s.status?.state);
  const [phase, setPhase] = useState<BadgePhase>('hidden');
  const wasSyncingRef = useRef(false);

  useEffect(() => {
    if (!connected) {
      wasSyncingRef.current = false;
      setPhase('hidden');
      return;
    }

    const next = resolveSyncBadgePhase(syncState, wasSyncingRef.current);
    if (syncState === 'syncing') {
      wasSyncingRef.current = true;
      setPhase('syncing');
      return;
    }

    if (next === 'synced' || next === 'error') {
      wasSyncingRef.current = false;
      setPhase(next);
      const timer = setTimeout(() => setPhase('hidden'), next === 'synced' ? 1600 : 2800);
      return () => clearTimeout(timer);
    }

    setPhase('hidden');
  }, [connected, syncState]);

  if (phase === 'hidden') {
    return null;
  }

  let label = 'Syncing...';
  let toneClass = 'text-tx-secondary';
  if (phase === 'synced') {
    label = 'Synced';
    toneClass = 'text-emerald-600 dark:text-emerald-400';
  } else if (phase === 'error') {
    label = 'Sync error';
    toneClass = 'text-amber-600 dark:text-amber-400';
  }

  const badge = (
    <output
      aria-live="polite"
      data-testid="cloud-sync-overlay"
      className={`fixed safe-bottom-4 safe-left-4 z-30 pointer-events-none inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.7rem] font-medium cover-overlay-chip shadow-md transition-opacity duration-300 ${toneClass}`}
    >
      {phase === 'synced' ? (
        <CheckIcon className="h-3.5 w-3.5 shrink-0" />
      ) : (
        <CloudIcon
          className={`h-3.5 w-3.5 shrink-0 ${phase === 'syncing' ? 'animate-pulse' : ''}`}
        />
      )}
      <span>{label}</span>
    </output>
  );

  if (hasDocument() && document.body) {
    return createPortal(badge, document.body);
  }
  return badge;
});
