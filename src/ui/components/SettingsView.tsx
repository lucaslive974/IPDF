import { useState } from 'react';
import { useTheme } from '../hooks/useTheme';

export interface SettingsViewProps {
  readonly syncExportPreview: string;
  readonly onRunCloudlessSync: () => void;
  readonly onBackToLibrary: () => void;
}

export function SettingsView({
  syncExportPreview,
  onRunCloudlessSync,
  onBackToLibrary,
}: SettingsViewProps) {
  const { theme, setTheme } = useTheme();
  const [monitoredFolders, setMonitoredFolders] = useState<string[]>([
    '~/Documents/PhilosophyBooks',
    '~/.var/app/com.ipdf.reader/data/books',
  ]);
  const [newFolderInput, setNewFolderInput] = useState('');
  const [isDriveConnected, setIsDriveConnected] = useState(true);
  const [syncStatusMessage, setSyncStatusMessage] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleAddFolder = () => {
    if (newFolderInput.trim().length > 0) {
      setMonitoredFolders((prev) => [...prev, newFolderInput.trim()]);
      setNewFolderInput('');
    }
  };

  const handleRemoveFolder = (index: number) => {
    setMonitoredFolders((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleTriggerSync = () => {
    onRunCloudlessSync();
    setSyncStatusMessage('Last-Write-Wins synchronization completed successfully!');
    setTimeout(() => setSyncStatusMessage(null), 4000);
  };

  return (
    <div className="min-h-screen bg-canvas text-tx-main flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line-subtle bg-surface/80 px-6 py-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-lg border border-line-subtle bg-surface px-3 py-1.5 text-xs font-semibold text-tx-secondary hover:bg-surface-subtle hover:text-tx-main transition active:scale-95"
            onClick={onBackToLibrary}
          >
            <span>&larr;</span>
            <span>Back to Library</span>
          </button>
          <h1 className="text-base font-bold text-tx-main">Settings &amp; Preferences</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 mx-auto w-full max-w-4xl px-6 py-8 flex flex-col gap-8">
        {/* Appearance & Theme Section */}
        <section className="flex flex-col gap-4 rounded-2xl border border-line-subtle bg-surface p-6 shadow-xs">
          <div>
            <h2 className="text-sm font-bold text-tx-main flex items-center gap-2">
              <span>🎨</span>
              <span>Appearance &amp; Theme</span>
            </h2>
            <p className="mt-1 text-xs text-tx-muted">
              Choose your reading workspace appearance. Color tokens adapt dynamically:
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md">
            <button
              type="button"
              className={`flex items-center justify-between rounded-xl border p-3.5 text-xs font-semibold transition ${
                theme === 'light'
                  ? 'border-brand bg-sky-50 dark:bg-sky-950/40 text-brand shadow-xs'
                  : 'border-line-subtle bg-surface-subtle text-tx-secondary hover:border-line-strong'
              }`}
              onClick={() => setTheme('light')}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-base">☀️</span>
                <div className="text-left">
                  <div className="font-bold">Light Theme</div>
                  <div className="text-[0.65rem] text-tx-muted">
                    Crisp off-white canvas for daylight
                  </div>
                </div>
              </div>
              {theme === 'light' && <span className="text-brand font-bold">✓</span>}
            </button>

            <button
              type="button"
              className={`flex items-center justify-between rounded-xl border p-3.5 text-xs font-semibold transition ${
                theme === 'dark'
                  ? 'border-brand bg-sky-50 dark:bg-sky-950/40 text-brand shadow-xs'
                  : 'border-line-subtle bg-surface-subtle text-tx-secondary hover:border-line-strong'
              }`}
              onClick={() => setTheme('dark')}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-base">🌙</span>
                <div className="text-left">
                  <div className="font-bold">Dark Theme</div>
                  <div className="text-[0.65rem] text-tx-muted">
                    OLED slate tones for low-light study
                  </div>
                </div>
              </div>
              {theme === 'dark' && <span className="text-brand font-bold">✓</span>}
            </button>
          </div>
        </section>

        {/* 1. Book Folders Configuration */}
        <section className="flex flex-col gap-4 rounded-2xl border border-line-subtle bg-surface p-6 shadow-xs">
          <div>
            <h2 className="text-sm font-bold text-tx-main flex items-center gap-2">
              <span>📁</span>
              <span>Monitored Book Folders</span>
            </h2>
            <p className="mt-1 text-xs text-tx-muted">
              The reader automatically indexes .epub and .pdf files found in these directories:
            </p>
          </div>

          <div className="flex flex-col gap-2">
            {monitoredFolders.map((folder, idx) => (
              <div
                key={`folder-${idx + 1}`}
                className="flex items-center justify-between rounded-xl border border-line-subtle bg-surface-subtle px-3.5 py-2.5 text-xs font-mono text-tx-secondary"
              >
                <span>{folder}</span>
                <button
                  type="button"
                  className="rounded px-2 py-1 text-tx-faint hover:bg-surface-hover hover:text-rose-500 transition"
                  onClick={() => handleRemoveFolder(idx)}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              className="flex-1 rounded-xl border border-line-subtle bg-surface-subtle px-3.5 py-2 text-xs text-tx-main placeholder:text-tx-faint focus:border-brand focus:outline-none"
              placeholder="e.g. /home/user/Ebooks or C:\Books"
              value={newFolderInput}
              onChange={(e) => setNewFolderInput(e.target.value)}
            />
            <button
              type="button"
              className="rounded-xl bg-surface-subtle border border-line-subtle px-4 py-2 text-xs font-semibold text-tx-secondary hover:bg-surface-hover transition active:scale-95"
              onClick={handleAddFolder}
            >
              + Add Folder
            </button>
          </div>
        </section>

        {/* 2. Google Drive & Cloudless Sync */}
        <section className="flex flex-col gap-4 rounded-2xl border border-line-subtle bg-surface p-6 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-tx-main flex items-center gap-2">
                <span>☁️</span>
                <span>Google Drive &amp; Cloudless Sync (BYOC)</span>
              </h2>
              <p className="mt-1 text-xs text-tx-muted">
                Zero-server sync using your personal cloud storage with Last-Write-Wins (LWW)
                conflict resolution:
              </p>
            </div>
            <span
              className={`rounded-full px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wider ${
                isDriveConnected
                  ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'border border-line-subtle bg-surface-subtle text-tx-muted'
              }`}
            >
              {isDriveConnected ? 'Drive Connected' : 'Disconnected'}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border border-line-subtle bg-surface-subtle p-4">
            <div>
              <span className="text-xs font-semibold text-tx-main block">
                Target Folder: /IPDF_Sync/
              </span>
              <span className="text-[0.7rem] text-tx-muted">
                Sync payload: .json highlights &amp; reading progress
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-brand-hover transition active:scale-95"
                onClick={handleTriggerSync}
              >
                Sync Now
              </button>
              <button
                type="button"
                className="rounded-lg border border-line-subtle bg-surface px-3 py-1.5 text-xs text-tx-secondary hover:bg-surface-hover transition"
                onClick={() => setIsDriveConnected((prev) => !prev)}
              >
                {isDriveConnected ? 'Disconnect' : 'Connect'}
              </button>
            </div>
          </div>

          {syncStatusMessage && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-600 dark:text-emerald-300 transition-opacity duration-200">
              {syncStatusMessage}
            </div>
          )}

          {syncExportPreview && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-tx-muted">
                Last Sync Payload Preview (LWW Engine):
              </span>
              <pre className="max-h-36 overflow-y-auto rounded-lg border border-line-subtle bg-surface-subtle p-3 font-mono text-[0.7rem] text-tx-secondary">
                {syncExportPreview}
              </pre>
            </div>
          )}
        </section>

        {/* 3. Data Portability (Import / Export) */}
        <section className="flex flex-col gap-4 rounded-2xl border border-line-subtle bg-surface p-6 shadow-xs">
          <div>
            <h2 className="text-sm font-bold text-tx-main flex items-center gap-2">
              <span>📦</span>
              <span>Data Portability &amp; Backup</span>
            </h2>
            <p className="mt-1 text-xs text-tx-muted">
              Export all your reading history, rich drawings, and study highlights into standard
              open formats:
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              type="button"
              className="flex flex-col gap-1 rounded-xl border border-line-subtle bg-surface-subtle p-4 text-left transition hover:border-line-strong hover:bg-surface-hover active:scale-98"
              onClick={handleTriggerSync}
            >
              <span className="text-xs font-bold text-tx-main">Export Highlights Backup</span>
              <span className="text-[0.7rem] text-tx-muted">
                Exports all annotations as a portable JSON or ZIP bundle.
              </span>
            </button>

            <button
              type="button"
              className="flex flex-col gap-1 rounded-xl border border-line-subtle bg-surface-subtle p-4 text-left transition hover:border-line-strong hover:bg-surface-hover active:scale-98"
              onClick={handleTriggerSync}
            >
              <span className="text-xs font-bold text-tx-main">Import Highlights Backup</span>
              <span className="text-[0.7rem] text-tx-muted">
                Merges external annotations using Last-Write-Wins rules.
              </span>
            </button>
          </div>
        </section>

        {/* 4. Danger Zone: Reset Data */}
        <section className="flex flex-col gap-4 rounded-2xl border border-rose-500/20 bg-rose-500/5 p-6 shadow-xs">
          <div>
            <h2 className="text-sm font-bold text-rose-600 dark:text-rose-400 flex items-center gap-2">
              <span>⚠️</span>
              <span>Reset Application Data</span>
            </h2>
            <p className="mt-1 text-xs text-tx-muted">
              Clear local SQLite databases, reset highlights, and purge cached book covers:
            </p>
          </div>

          {!showResetConfirm ? (
            <div>
              <button
                type="button"
                className="rounded-xl border border-rose-600/30 bg-rose-500/10 px-4 py-2 text-xs font-semibold text-rose-600 dark:text-rose-300 hover:bg-rose-500/20 transition active:scale-95"
                onClick={() => setShowResetConfirm(true)}
              >
                Reset App Data &amp; Cache
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4">
              <span className="text-xs text-rose-700 dark:text-rose-200 font-semibold flex-1">
                Are you sure? This action will reset your local database.
              </span>
              <button
                type="button"
                className="rounded-lg bg-rose-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-500 transition"
                onClick={() => {
                  setShowResetConfirm(false);
                  alert('App data reset simulator triggered.');
                }}
              >
                Yes, Reset All
              </button>
              <button
                type="button"
                className="rounded-lg border border-line-subtle bg-surface px-3 py-1.5 text-xs text-tx-secondary hover:bg-surface-hover transition"
                onClick={() => setShowResetConfirm(false)}
              >
                Cancel
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
