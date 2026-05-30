import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';

type Props = {
  values: number[]; // 0..100
  width?: number;
  height?: number;
  color?: string;
};

export function MiniSparkline({ values, width = 280, height = 80, color = '#0A84FF' }: Props) {
  if (values.length === 0) return null;
  const pad = 6;
  const w = width - pad * 2;
  const h = height - pad * 2;
  const pts = values.map((v, i) => {
    const x = pad + (i / Math.max(1, values.length - 1)) * w;
    const y = pad + h - (Math.max(0, Math.min(100, v)) / 100) * h;
    return `${x},${y}`;
  });
  return (
    <View style={styles.wrap}>
      <Svg width={width} height={height}>
        <Polyline
          points={pts.join(' ')}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    marginVertical: 8,
    borderRadius: 14,
    paddingVertical: 4,
  },
});
