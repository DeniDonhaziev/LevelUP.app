import { View, StyleSheet } from 'react-native';

type Props = {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
};

/** Веб: столбики вместо SVG. */
export function MiniSparkline({ values, width = 280, height = 80, color = '#2dd4bf' }: Props) {
  if (values.length === 0) return null;
  const gap = 2;
  const barW = Math.max(2, (width - gap * (values.length - 1)) / values.length);
  return (
    <View style={[styles.wrap, { width, height }]}>
      {values.map((v, i) => {
        const h = (Math.max(0, Math.min(100, v)) / 100) * (height - 8);
        return (
          <View
            key={i}
            style={[
              styles.bar,
              {
                width: barW,
                height: Math.max(2, h),
                backgroundColor: color,
                marginRight: i < values.length - 1 ? gap : 0,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginVertical: 8,
  },
  bar: { borderRadius: 2 },
});
