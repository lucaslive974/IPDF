import { useNavigation } from '../hooks/useNavigation';
import { useSettings } from '../hooks/useSettings';
import { useTheme } from '../hooks/useTheme';
import {
  ArrowLeftIcon,
  Badge,
  Button,
  Card,
  CloseIcon,
  IconButton,
  Input,
  MoonIcon,
  SunIcon,
} from './ui';

export function SettingsView() {
  const { theme, setTheme } = useTheme();
  const navigation = useNavigation();
  const settings = useSettings();

  return (
    <div className="min-h-screen bg-canvas text-tx-main flex flex-col font-sans">
      {/* Header */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line-subtle/70 bg-canvas/80 px-6 py-3.5 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            iconLeft={<ArrowLeftIcon className="h-3.5 w-3.5" />}
            onClick={navigation.closeSettings}
          >
            Library
          </Button>
          <h1 className="text-sm font-semibold text-tx-main tracking-tight">Preferences</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 mx-auto w-full max-w-3xl px-6 py-8 flex flex-col gap-6">
        {/* Appearance & Theme Section */}
        <Card variant="surface" padding="md" className="flex flex-col gap-4">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-tx-muted">
              Appearance
            </h2>
            <p className="mt-1 text-xs text-tx-secondary">
              Select reading workspace theme. Tokens adapt to minimize eye strain:
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md">
            <button
              type="button"
              className={`flex items-center justify-between rounded-lg border p-3 text-xs font-medium transition cursor-pointer ${
                theme === 'light'
                  ? 'border-tx-main bg-surface-subtle text-tx-main shadow-2xs'
                  : 'border-line-subtle bg-surface/50 text-tx-muted hover:border-line-strong'
              }`}
              onClick={() => setTheme('light')}
            >
              <div className="flex items-center gap-2.5">
                <SunIcon className="h-4 w-4 text-tx-main" />
                <div className="text-left">
                  <div className="font-medium text-tx-main">Warm Paper</div>
                  <div className="text-[0.65rem] text-tx-muted">
                    Ivory tone for daylight reading
                  </div>
                </div>
              </div>
              {theme === 'light' && (
                <span className="text-tx-main font-semibold text-xs">Active</span>
              )}
            </button>

            <button
              type="button"
              className={`flex items-center justify-between rounded-lg border p-3 text-xs font-medium transition cursor-pointer ${
                theme === 'dark'
                  ? 'border-tx-main bg-surface-subtle text-tx-main shadow-2xs'
                  : 'border-line-subtle bg-surface/50 text-tx-muted hover:border-line-strong'
              }`}
              onClick={() => setTheme('dark')}
            >
              <div className="flex items-center gap-2.5">
                <MoonIcon className="h-4 w-4 text-tx-main" />
                <div className="text-left">
                  <div className="font-medium text-tx-main">Warm Graphite</div>
                  <div className="text-[0.65rem] text-tx-muted">
                    Soft charcoal for low-light study
                  </div>
                </div>
              </div>
              {theme === 'dark' && (
                <span className="text-tx-main font-semibold text-xs">Active</span>
              )}
            </button>
          </div>
        </Card>

        {/* 1. Book Folders Configuration */}
        <Card variant="surface" padding="md" className="flex flex-col gap-4">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-tx-muted">
              Monitored Storage Folders
            </h2>
            <p className="mt-1 text-xs text-tx-secondary">
              The reader automatically indexes .epub and .pdf files found in these directories:
            </p>
          </div>

          <div className="flex flex-col gap-2">
            {settings.monitoredFolders.map((folder, idx) => (
              <Card
                key={`folder-${idx + 1}`}
                variant="subtle"
                padding="sm"
                rounded="lg"
                className="flex items-center justify-between font-mono text-xs text-tx-secondary"
              >
                <span>{folder}</span>
                <IconButton
                  variant="ghost"
                  size="xs"
                  label="Remove folder"
                  onClick={() => settings.removeFolder(idx)}
                >
                  <CloseIcon className="h-3.5 w-3.5" />
                </IconButton>
              </Card>
            ))}
          </div>

          <div className="flex gap-2">
            <Input
              containerClassName="flex-1"
              placeholder="e.g. /home/user/Books"
              value={settings.newFolderInput}
              onChange={(e) => settings.setNewFolderInput(e.target.value)}
            />
            <Button variant="secondary" size="md" onClick={settings.addFolder}>
              Add Directory
            </Button>
          </div>
        </Card>

        {/* 2. Google Drive & Cloudless Sync */}
        <Card variant="surface" padding="md" className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-tx-muted">
                Cloudless Sync (BYOC)
              </h2>
              <p className="mt-1 text-xs text-tx-secondary">
                Zero-server synchronization with Last-Write-Wins (LWW) conflict resolution:
              </p>
            </div>
            <Badge variant="neutral" size="xs">
              {settings.isDriveConnected ? 'Connected' : 'Local Only'}
            </Badge>
          </div>

          <Card
            variant="subtle"
            padding="sm"
            rounded="lg"
            className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
          >
            <div>
              <span className="text-xs font-medium text-tx-main block">Target: /IPDF_Sync/</span>
              <span className="text-[0.68rem] text-tx-muted">
                Highlights, reading metrics, and margin notes
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="primary" size="sm" onClick={() => void settings.triggerSync()}>
                Sync Now
              </Button>
              <Button variant="outline" size="sm" onClick={settings.toggleDriveConnection}>
                {settings.isDriveConnected ? 'Disconnect' : 'Connect'}
              </Button>
            </div>
          </Card>

          {settings.syncStatusMessage && (
            <div className="rounded-lg border border-line-subtle bg-surface-subtle p-3 text-xs text-tx-secondary transition-opacity duration-200">
              {settings.syncStatusMessage}
            </div>
          )}
        </Card>

        {/* 3. Data Portability */}
        <Card variant="surface" padding="md" className="flex flex-col gap-4">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-tx-muted">
              Data Portability
            </h2>
            <p className="mt-1 text-xs text-tx-secondary">
              Export reading metrics and annotations into standard open formats:
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Card
              variant="interactive"
              padding="sm"
              rounded="lg"
              className="flex flex-col gap-1 text-left"
              onClick={() => void settings.triggerSync()}
            >
              <span className="text-xs font-medium text-tx-main">Export Annotations</span>
              <span className="text-[0.68rem] text-tx-muted">
                Package all notes and highlights as a JSON bundle.
              </span>
            </Card>

            <Card
              variant="interactive"
              padding="sm"
              rounded="lg"
              className="flex flex-col gap-1 text-left"
              onClick={() => void settings.triggerSync()}
            >
              <span className="text-xs font-medium text-tx-main">Import Backup</span>
              <span className="text-[0.68rem] text-tx-muted">
                Merge external notes using Last-Write-Wins rules.
              </span>
            </Card>
          </div>
        </Card>

        {/* 4. Danger Zone: Reset Data */}
        <Card variant="subtle" padding="md" className="flex flex-col gap-4 border-line-subtle">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-tx-muted">
              Maintenance
            </h2>
            <p className="mt-1 text-xs text-tx-secondary">
              Clear local SQLite databases, reset highlights, and purge cached book covers:
            </p>
          </div>

          {!settings.showResetConfirm ? (
            <div>
              <Button
                variant="danger-subtle"
                size="sm"
                onClick={() => settings.setShowResetConfirm(true)}
              >
                Reset Database &amp; Cache
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-lg border border-line-strong bg-surface p-3.5">
              <span className="text-xs text-tx-main font-medium flex-1">
                Are you sure? This action will reset your local database.
              </span>
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  void settings.resetDatabase();
                  alert('Database reset completed.');
                }}
              >
                Confirm Reset
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => settings.setShowResetConfirm(false)}
              >
                Cancel
              </Button>
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
