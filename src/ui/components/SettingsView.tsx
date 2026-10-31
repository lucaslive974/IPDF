import { useState } from 'react';

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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-800 bg-slate-950/80 px-6 py-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition active:scale-95"
            onClick={onBackToLibrary}
          >
            <span>&larr;</span>
            <span>Back to Library</span>
          </button>
          <h1 className="text-base font-bold text-slate-100">Settings &amp; Preferences</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 mx-auto w-full max-w-4xl px-6 py-8 flex flex-col gap-8">
        {/* 1. Book Folders Configuration */}
        <section className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm">
          <div>
            <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <span>📁</span>
              <span>Monitored Book Folders</span>
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              The reader automatically indexes .epub and .pdf files found in these directories:
            </p>
          </div>

          <div className="flex flex-col gap-2">
            {monitoredFolders.map((folder, idx) => (
              <div
                key={`folder-${idx + 1}`}
                className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-xs font-mono text-slate-300"
              >
                <span>{folder}</span>
                <button
                  type="button"
                  className="rounded px-2 py-1 text-slate-500 hover:bg-slate-800 hover:text-rose-400 transition"
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
              className="flex-1 rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
              placeholder="e.g. /home/user/Ebooks or C:\Books"
              value={newFolderInput}
              onChange={(e) => setNewFolderInput(e.target.value)}
            />
            <button
              type="button"
              className="rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition active:scale-95"
              onClick={handleAddFolder}
            >
              + Add Folder
            </button>
          </div>
        </section>

        {/* 2. Google Drive & Cloudless Sync */}
        <section className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <span>☁️</span>
                <span>Google Drive &amp; Cloudless Sync (BYOC)</span>
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                Zero-server sync using your personal cloud storage with Last-Write-Wins (LWW)
                conflict resolution:
              </p>
            </div>
            <span
              className={`rounded-full px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wider ${
                isDriveConnected
                  ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                  : 'border border-slate-700 bg-slate-800 text-slate-400'
              }`}
            >
              {isDriveConnected ? 'Drive Connected' : 'Disconnected'}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-950 p-4">
            <div>
              <span className="text-xs font-semibold text-slate-200 block">
                Target Folder: /IPDF_Sync/
              </span>
              <span className="text-[0.7rem] text-slate-500">
                Sync payload: .json highlights &amp; reading progress
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-lg bg-sky-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow hover:bg-sky-500 transition active:scale-95"
                onClick={handleTriggerSync}
              >
                Sync Now
              </button>
              <button
                type="button"
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 transition"
                onClick={() => setIsDriveConnected((prev) => !prev)}
              >
                {isDriveConnected ? 'Disconnect' : 'Connect'}
              </button>
            </div>
          </div>

          {syncStatusMessage && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300 transition-opacity duration-200">
              {syncStatusMessage}
            </div>
          )}

          {syncExportPreview && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-slate-400">
                Last Sync Payload Preview (LWW Engine):
              </span>
              <pre className="max-h-36 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-[0.7rem] text-slate-400">
                {syncExportPreview}
              </pre>
            </div>
          )}
        </section>

        {/* 3. Data Portability (Import / Export) */}
        <section className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm">
          <div>
            <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <span>📦</span>
              <span>Data Portability &amp; Backup</span>
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Export all your reading history, rich drawings, and study highlights into standard
              open formats:
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              type="button"
              className="flex flex-col gap-1 rounded-xl border border-slate-800 bg-slate-950 p-4 text-left transition hover:border-slate-700 hover:bg-slate-900 active:scale-98"
              onClick={handleTriggerSync}
            >
              <span className="text-xs font-bold text-slate-200">Export Highlights Backup</span>
              <span className="text-[0.7rem] text-slate-400">
                Exports all annotations as a portable JSON or ZIP bundle.
              </span>
            </button>

            <button
              type="button"
              className="flex flex-col gap-1 rounded-xl border border-slate-800 bg-slate-950 p-4 text-left transition hover:border-slate-700 hover:bg-slate-900 active:scale-98"
              onClick={handleTriggerSync}
            >
              <span className="text-xs font-bold text-slate-200">Import Highlights Backup</span>
              <span className="text-[0.7rem] text-slate-400">
                Merges external annotations using Last-Write-Wins rules.
              </span>
            </button>
          </div>
        </section>

        {/* 4. Danger Zone: Reset Data */}
        <section className="flex flex-col gap-4 rounded-2xl border border-rose-950/40 bg-rose-950/10 p-6 shadow-sm">
          <div>
            <h2 className="text-sm font-bold text-rose-300 flex items-center gap-2">
              <span>⚠️</span>
              <span>Reset Application Data</span>
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Clear local SQLite databases, reset highlights, and purge cached book covers:
            </p>
          </div>

          {!showResetConfirm ? (
            <div>
              <button
                type="button"
                className="rounded-xl border border-rose-700/50 bg-rose-900/30 px-4 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-900/50 transition active:scale-95"
                onClick={() => setShowResetConfirm(true)}
              >
                Reset App Data &amp; Cache
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-xl border border-rose-800 bg-rose-950/60 p-4">
              <span className="text-xs text-rose-200 font-semibold flex-1">
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
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 transition"
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
