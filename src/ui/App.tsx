import { LibraryView } from './components/LibraryView';
import { ReaderView } from './components/ReaderView';
import { SettingsView } from './components/SettingsView';
import { useSystemHandler } from './hooks/useSystemHandler';
import { NavigationProvider, useNavigation } from './providers/NavigationContext';
import { ServiceContainerProvider } from './providers/ServiceContainerContext';
import { ThemeProvider } from './providers/ThemeContext';

function AppRouter() {
  useSystemHandler();
  const { currentView } = useNavigation();

  if (currentView === 'reader') {
    return <ReaderView />;
  }

  if (currentView === 'settings') {
    return <SettingsView />;
  }

  return <LibraryView />;
}

export function App() {
  return (
    <ThemeProvider>
      <ServiceContainerProvider>
        <NavigationProvider>
          <AppRouter />
        </NavigationProvider>
      </ServiceContainerProvider>
    </ThemeProvider>
  );
}
