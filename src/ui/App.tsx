import { LibraryView } from './components/LibraryView';
import { ReaderView } from './components/ReaderView';
import { SettingsView } from './components/SettingsView';
import { useNavigation } from './hooks/useNavigation';
import { NavigationProvider } from './providers/NavigationContext';
import { ServiceContainerProvider } from './providers/ServiceContainerContext';
import { ThemeProvider } from './providers/ThemeContext';

function AppRouter() {
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
