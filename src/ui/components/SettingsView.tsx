import { useState } from 'react';
import { useTheme } from '../hooks/useTheme';
import { Badge, Button, Card, IconButton, Input } from './ui';

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
          <Button variant="outline" size="sm" iconLeft="←" onClick={onBackToLibrary}>
            Back to Library
          </Button>
          <h1 className="text-base font-bold text-tx-main">Settings &amp; Preferences</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 mx-auto w-full max-w-4xl px-6 py-8 flex flex-col gap-8">
        {/* Appearance & Theme Section */}
        <Card variant="surface" padding="md" className="flex flex-col gap-4">
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
              className={`flex items-center justify-between rounded-xl border p-3.5 text-xs font-semibold transition cursor-pointer ${
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
              className={`flex items-center justify-between rounded-xl border p-3.5 text-xs font-semibold transition cursor-pointer ${
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
        </Card>

        {/* 1. Book Folders Configuration */}
        <Card variant="surface" padding="md" className="flex flex-col gap-4">
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
              <Card
                key={`folder-${idx + 1}`}
                variant="subtle"
                padding="sm"
                rounded="xl"
                className="flex items-center justify-between font-mono text-xs text-tx-secondary"
              >
                <span>{folder}</span>
                <IconButton
                  variant="ghost"
                  size="xs"
                  label="Remove folder"
                  onClick={() => handleRemoveFolder(idx)}
                >
                  ✕
                </IconButton>
              </Card>
            ))}
          </div>

          <div className="flex gap-2">
            <Input
              containerClassName="flex-1"
              placeholder="e.g. /home/user/Ebooks or C:\Books"
              value={newFolderInput}
              onChange={(e) => setNewFolderInput(e.target.value)}
            />
            <Button variant="secondary" size="md" onClick={handleAddFolder}>
              + Add Folder
            </Button>
          </div>
        </Card>

        {/* 2. Google Drive & Cloudless Sync */}
        <Card variant="surface" padding="md" className="flex flex-col gap-4">
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
            <Badge variant={isDriveConnected ? 'success' : 'neutral'} size="xs">
              {isDriveConnected ? 'Drive Connected' : 'Disconnected'}
            </Badge>
          </div>

          <Card
            variant="subtle"
            padding="sm"
            rounded="xl"
            className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
          >
            <div>
              <span className="text-xs font-semibold text-tx-main block">
                Target Folder: /IPDF_Sync/
              </span>
              <span className="text-[0.7rem] text-tx-muted">
                Sync payload: .json highlights &amp; reading progress
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="primary" size="sm" onClick={handleTriggerSync}>
                Sync Now
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsDriveConnected((prev) => !prev)}
              >
                {isDriveConnected ? 'Disconnect' : 'Connect'}
              </Button>
            </div>
          </Card>

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
        </Card>

        {/* 3. Data Portability (Import / Export) */}
        <Card variant="surface" padding="md" className="flex flex-col gap-4">
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
            <Card
              variant="interactive"
              padding="sm"
              rounded="xl"
              className="flex flex-col gap-1 text-left"
              onClick={handleTriggerSync}
            >
              <span className="text-xs font-bold text-tx-main">Export Highlights Backup</span>
              <span className="text-[0.7rem] text-tx-muted">
                Exports all annotations as a portable JSON or ZIP bundle.
              </span>
            </Card>

            <Card
              variant="interactive"
              padding="sm"
              rounded="xl"
              className="flex flex-col gap-1 text-left"
              onClick={handleTriggerSync}
            >
              <span className="text-xs font-bold text-tx-main">Import Highlights Backup</span>
              <span className="text-[0.7rem] text-tx-muted">
                Merges external annotations using Last-Write-Wins rules.
              </span>
            </Card>
          </div>
        </Card>

        {/* 4. Danger Zone: Reset Data */}
        <Card
          variant="subtle"
          padding="md"
          className="border-rose-500/20 bg-rose-500/5 flex flex-col gap-4"
        >
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
              <Button variant="danger-subtle" size="md" onClick={() => setShowResetConfirm(true)}>
                Reset App Data &amp; Cache
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4">
              <span className="text-xs text-rose-700 dark:text-rose-200 font-semibold flex-1">
                Are you sure? This action will reset your local database.
              </span>
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  setShowResetConfirm(false);
                  alert('App data reset simulator triggered.');
                }}
              >
                Yes, Reset All
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowResetConfirm(false)}>
                Cancel
              </Button>
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
