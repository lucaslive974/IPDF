import { useNavigation } from '../hooks/useNavigation';
import { useSettings } from '../hooks/useSettings';
import { useTheme } from '../hooks/useTheme';
import { SettingsAppearanceSection } from './settings/SettingsAppearanceSection';
import { SettingsDangerSection } from './settings/SettingsDangerSection';
import { SettingsFoldersSection } from './settings/SettingsFoldersSection';
import { SettingsHeader } from './settings/SettingsHeader';
import { SettingsIntegrationsSection } from './settings/SettingsIntegrationsSection';
import { SettingsPortabilitySection } from './settings/SettingsPortabilitySection';
import { SettingsSyncSection } from './settings/SettingsSyncSection';

export function SettingsView() {
  const { theme, setTheme } = useTheme();
  const navigation = useNavigation();
  const settings = useSettings();

  return (
    <div className="min-h-screen bg-canvas text-tx-main flex flex-col font-sans">
      <SettingsHeader onBack={navigation.closeSettings} />

      <main className="flex-1 mx-auto w-full max-w-3xl px-6 py-8 flex flex-col gap-6">
        <SettingsAppearanceSection theme={theme} onSetTheme={setTheme} />

        <SettingsFoldersSection
          monitoredFolders={settings.monitoredFolders}
          newFolderInput={settings.newFolderInput}
          onNewFolderInputChange={settings.setNewFolderInput}
          onAddFolder={settings.addFolder}
          onRemoveFolder={settings.removeFolder}
        />

        <SettingsSyncSection
          isDriveConnected={settings.isDriveConnected}
          syncStatusMessage={settings.syncStatusMessage}
          onTriggerSync={() => void settings.triggerSync()}
          onToggleDriveConnection={settings.toggleDriveConnection}
        />

        <SettingsIntegrationsSection
          isDiscordEnabled={settings.isDiscordEnabled}
          onToggleDiscord={() => void settings.toggleDiscordPresence()}
        />

        <SettingsPortabilitySection
          onExportAnnotations={() => void settings.triggerSync()}
          onImportBackup={() => void settings.triggerSync()}
        />

        <SettingsDangerSection
          showResetConfirm={settings.showResetConfirm}
          onShowResetConfirm={settings.setShowResetConfirm}
          onResetDatabase={() => void settings.resetDatabase()}
        />
      </main>
    </div>
  );
}
