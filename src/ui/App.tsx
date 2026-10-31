import { LibraryView } from './components/LibraryView';
import { ReaderView } from './components/ReaderView';
import { SettingsView } from './components/SettingsView';
import { useNavigation } from './hooks/useNavigation';
import { LibraryProvider } from './providers/LibraryContext';
import { NavigationProvider } from './providers/NavigationContext';
import { ReaderProvider } from './providers/ReaderContext';
import { ServiceContainerProvider } from './providers/ServiceContainerContext';
import { ThemeProvider } from './providers/ThemeContext';

function AppRouter() {
  const { currentView, selectedBook } = useNavigation();

  if (currentView === 'reader') {
    return (
      <ReaderProvider book={selectedBook}>
        <ReaderView />
      </ReaderProvider>
    );
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
          <LibraryProvider>
            <AppRouter />
          </LibraryProvider>
        </NavigationProvider>
      </ServiceContainerProvider>
    </ThemeProvider>
  );
}
