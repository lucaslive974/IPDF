import {
  type AppViewMode,
  type NavigationContextValue,
  useNavigationContext,
} from '@providers/NavigationContext';

export type { AppViewMode, NavigationContextValue };

export function useNavigation(): NavigationContextValue {
  return useNavigationContext();
}
