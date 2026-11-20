import { useSettings } from '@hooks/useSettings';
import { useNavigation } from '@providers/NavigationContext';
import { useTheme } from '@providers/ThemeContext';
import { SettingsAppearanceSection } from './settings/SettingsAppearanceSection';
import { SettingsBackupSection } from './settings/SettingsBackupSection';
import { SettingsDangerSection } from './settings/SettingsDangerSection';
import { SettingsHeader } from './settings/SettingsHeader';
import { SettingsIntegrationsSection } from './settings/SettingsIntegrationsSection';
import { SettingsSyncSection } from './settings/SettingsSyncSection';

export function SettingsView() {
  const { theme, setTheme } = useTheme();
  const navigation = useNavigation();
  const settings = useSettings();

  return (
    <div className="app-page-shell">
      <SettingsHeader onBack={navigation.closeSettings} />

      <main className="flex-1 mx-auto w-full max-w-3xl px-6 py-8 flex flex-col gap-6">
        <SettingsAppearanceSection theme={theme} onSetTheme={setTheme} />

        {__ENABLE_CLOUD_SYNC__ && <SettingsSyncSection />}

        {!__IS_MOBILE__ && settings.supportsDiscordPresence && (
          <SettingsIntegrationsSection
            isDiscordEnabled={settings.isDiscordEnabled}
            discordHealth={settings.discordHealth}
            onToggleDiscord={() => void settings.toggleDiscordPresence()}
          />
        )}

        <SettingsBackupSection />

        <SettingsDangerSection
          showResetConfirm={settings.showResetConfirm}
          isResetting={settings.isResettingDatabase}
          resetError={settings.resetError}
          onShowResetConfirm={settings.setShowResetConfirm}
          onResetDatabase={() => void settings.resetDatabase()}
        />
      </main>
    </div>
  );
}
