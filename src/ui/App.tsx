import { LibraryView } from './components/LibraryView';
import { ReaderView } from './components/ReaderView';
import { SettingsView } from './components/SettingsView';
import { useSystemHandler } from './hooks/useSystemHandler';
import { NavigationProvider, useNavigation } from './providers/NavigationContext';
import { ServiceContainerProvider } from './providers/ServiceContainerContext';
import { ThemeProvider } from './providers/ThemeContext';

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
