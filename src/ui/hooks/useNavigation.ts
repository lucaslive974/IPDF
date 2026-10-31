import { type NavigationContextValue, useNavigationContext } from '../providers/NavigationContext';

export function useNavigation(): NavigationContextValue {
  return useNavigationContext();
}
