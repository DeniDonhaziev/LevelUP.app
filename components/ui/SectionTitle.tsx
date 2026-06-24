import { StyleSheet, Text, View } from 'react-native';

import { useThemeColors } from '@/hooks/useThemeColors';
import { screenLayout } from '@/lib/screenLayout';

type Props = {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  large?: boolean;
};

export function SectionTitle({ title, subtitle, action, large = true }: Props) {
  const c = useThemeColors();

  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={[large ? screenLayout.pageTitle : styles.compactTitle, { color: c.text }]}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[screenLayout.pageSubtitle, { color: c.muted }]}>{subtitle}</Text>
        ) : null}
      </View>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 10,
    gap: 12,
  },
  compactTitle: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -0.4,
  },
});
