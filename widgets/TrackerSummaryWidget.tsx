import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';

type Props = {
  stepsToday: number;
  streak: number;
  userName: string;
};

export function TrackerSummaryWidget({ stepsToday, streak, userName }: Props) {
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        width: 'match_parent',
        height: 'match_parent',
        backgroundColor: '#121212',
        borderRadius: 16,
        padding: 14,
      }}>
      <TextWidget
        text={`Привет, ${userName}`}
        style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '600' }}
      />
      <TextWidget
        text={`${stepsToday.toLocaleString('ru-RU')} шагов`}
        style={{ color: '#FFFFFF', fontSize: 24, fontWeight: '700', marginTop: 8 }}
      />
      <TextWidget
        text={`Серия: ${streak} дн.`}
        style={{ color: 'rgba(255,255,255,0.86)', fontSize: 13, marginTop: 6 }}
      />
    </FlexWidget>
  );
}
