import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useThemeColors } from '@/hooks/useThemeColors';
import { WebTheme } from '@/lib/theme';

type Option<T extends string> = {
  key: T;
  label: string;
};

type Props<T extends string> = {
  value: T;
  options: Option<T>[];
  onChange: (key: T) => void;
};

export function SegmentedControl<T extends string>({ value, options, onChange }: Props<T>) {
  const c = useThemeColors();

  return (
    <View style={[styles.wrap, { backgroundColor: c.card, borderColor: c.border }]}>
      {options.map((opt) => {
        const active = opt.key === value;
        return (
          <Pressable
            key={opt.key}
            onPress={() => onChange(opt.key)}
            style={[
              styles.segment,
              active && { backgroundColor: c.cardElevated, borderColor: c.border },
            ]}>
            <Text
              style={{
                color: active ? c.text : c.muted,
                fontFamily: active ? 'Inter_600SemiBold' : 'Inter_500Medium',
                fontSize: 14,
              }}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    borderRadius: WebTheme.radiusSm,
    borderWidth: 1,
    padding: 3,
    gap: 4,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: WebTheme.radiusXs,
    borderWidth: 1,
    borderColor: 'transparent',
  },
});
