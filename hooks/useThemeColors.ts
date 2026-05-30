import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

export function useThemeColors() {
  const scheme = useColorScheme() ?? 'dark';
  return Colors[scheme];
}

export function useIsDarkMode() {
  return (useColorScheme() ?? 'dark') === 'dark';
}
