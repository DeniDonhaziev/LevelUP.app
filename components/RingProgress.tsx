import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';

type Props = {
  size?: number;
  strokeWidth?: number;
  progress: number; // 0..1
  /** Сдвиг старта дуги по часовой от 12:00 (0 = линия с верхнего центра) */
  startAngleDeg?: number;
  color?: string;
  trackColor?: string;
  centerColor?: string;
  centerTitle?: string;
  centerSubtitle?: string;
};

/** Нейтральное кольцо прогресса в светлой палитре. */
export function RingProgress({
  size = 100,
  strokeWidth = 8,
  progress,
  startAngleDeg = 0,
  color = '#0A84FF',
  trackColor = 'rgba(120, 120, 128, 0.22)',
  centerColor = 'transparent',
  centerTitle,
  centerSubtitle,
}: Props) {
  /** Трек по внешнему кругу; дуга прогресса на чуть меньшем r — иначе пунктир в RN часто «рисуется» к внешнему краю белой полосы */
  const rTrack = (size - strokeWidth) / 2;
  const rProgress = Math.max(0, rTrack - 0.75);
  const cTrack = 2 * Math.PI * rTrack;
  const cProgress = 2 * Math.PI * rProgress;
  const p = Math.max(0, Math.min(1, progress));
  const lineCap: 'round' | 'butt' = p > 0 && p < 0.06 ? 'butt' : 'round';
  const offset = cProgress * (1 - p);
  /** Внутренний край кольца по треку */
  const innerHoleR = Math.max(0, rTrack - strokeWidth / 2);
  const cx = size / 2;
  const cy = size / 2;
  /** SVG: 0° в 3:00; -90° + startAngleDeg → старт дуги в 12:00 при startAngleDeg=0 */
  const rotateDeg = -90 + startAngleDeg;
  const innerD = innerHoleR * 2;
  const endAngle = -Math.PI / 2 + 2 * Math.PI * p + (startAngleDeg * Math.PI) / 180;
  const endX = cx + rProgress * Math.cos(endAngle);
  const endY = cy + rProgress * Math.sin(endAngle);

  return (
    <View style={{ width: size, height: size, position: 'relative', alignSelf: 'center' }}>
      {/* Центр: flex-центрирование вместо left/top — без дробных координат, концентрично с SVG */}
      {innerHoleR > 0 ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: size,
            height: size,
            justifyContent: 'center',
            alignItems: 'center',
          }}>
          <View
            style={{
              width: innerD,
              height: innerD,
              borderRadius: innerD / 2,
              backgroundColor: centerColor,
            }}
          />
        </View>
      ) : null}
      <Svg width={size} height={size}>
        <Defs>
          <SvgLinearGradient id="ringProgressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={color} />
            <Stop offset="100%" stopColor={color} />
          </SvgLinearGradient>
        </Defs>
        <Circle
          cx={cx}
          cy={cy}
          r={rTrack}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          transform={`rotate(${rotateDeg} ${cx} ${cy})`}
        />
        <Circle
          cx={cx}
          cy={cy}
          r={rProgress}
          stroke="url(#ringProgressGradient)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${cProgress} ${cProgress}`}
          strokeDashoffset={offset}
          strokeLinecap={lineCap}
          strokeLinejoin="round"
          transform={`rotate(${rotateDeg} ${cx} ${cy})`}
        />
        {p > 0 ? (
          <Circle
            cx={endX}
            cy={endY}
            r={Math.max(3, strokeWidth * 0.26)}
            fill={color}
          />
        ) : null}
      </Svg>
      {centerTitle != null && centerTitle !== '' ? (
        <View style={[styles.centerOverlay, { width: size, height: size }]} pointerEvents="none">
          <View style={styles.centerLine}>
            <Text style={styles.centerTitle}>{centerTitle}</Text>
            {centerSubtitle != null && centerSubtitle !== '' ? (
              <Text style={styles.centerSub}>{centerSubtitle}</Text>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  centerOverlay: {
    position: 'absolute',
    left: 0,
    top: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  /** Цифра и % в одну линию */
  centerLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
  },
  centerTitle: {
    fontSize: 36,
    lineHeight: 40,
    fontFamily: 'Inter_700Bold',
    color: '#161822',
    letterSpacing: -0.8,
  },
  centerSub: {
    marginLeft: 2,
    fontSize: 18,
    lineHeight: 22,
    fontFamily: 'Inter_600SemiBold',
    color: '#73798A',
    letterSpacing: 0,
  },
});
