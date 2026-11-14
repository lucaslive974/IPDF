import { TransitionOverlay } from '@ui';
import { LibraryView } from './components/LibraryView';
import { ReaderView } from './components/ReaderView';
import { SettingsView } from './components/SettingsView';
import { StartupSplash } from './components/StartupSplash';
import { useAppStartup } from './hooks/useAppStartup';
import { useSystemHandler } from './hooks/useSystemHandler';
import { NavigationProvider, useNavigation } from './providers/NavigationContext';
import { ServiceContainerProvider } from './providers/ServiceContainerContext';
import { ThemeProvider, useTheme } from './providers/ThemeContext';

function AppRouter() {
  const { currentView, selectedBook, openReader, closeReader } = useNavigation();
  useSystemHandler({ onOpenBook: openReader });

  if (currentView === 'reader') {
    return <ReaderView book={selectedBook} onClose={closeReader} />;
  }

  if (currentView === 'settings') {
    return <SettingsView />;
  }

  return <LibraryView />;
}

function AppShell() {
  const startup = useAppStartup();
  const { theme } = useTheme();

  return (
    <>
      <AppRouter />
      <TransitionOverlay
        isVisible={startup.isOverlayVisible}
        minDisplayMs={startup.minDisplayMs}
        durationMs={450}
        zIndexClass="z-50"
        testId="startup-transition-overlay"
      >
        <StartupSplash
          status={startup.status}
          error={startup.error}
          theme={theme}
          onRetry={startup.retry}
        />
      </TransitionOverlay>
    </>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <ServiceContainerProvider>
        <NavigationProvider>
          <AppShell />
        </NavigationProvider>
      </ServiceContainerProvider>
    </ThemeProvider>
  );
}
