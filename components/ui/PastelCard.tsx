import { StyleSheet, View, type ViewProps } from 'react-native';

import { pastelPair, type PastelVariant } from '@/lib/pastelTheme';
import { WebTheme } from '@/lib/theme';

type Props = ViewProps & {
  children: React.ReactNode;
  variant?: PastelVariant;
  elevated?: boolean;
};

export function PastelCard({ children, variant = 'white', elevated, style, ...rest }: Props) {
  const pair = pastelPair(variant);
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: pair.bg,
          borderColor: elevated ? 'rgba(255,255,255,0.8)' : 'rgba(45,49,66,0.04)',
        },
        style,
      ]}
      {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: WebTheme.radiusLg,
    borderWidth: 1,
    padding: 16,
    ...WebTheme.shadowSoft,
  },
});
