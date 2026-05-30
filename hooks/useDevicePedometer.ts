import { Pedometer } from 'expo-sensors';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';

import { useTrackerStore } from '@/store/trackerStore';

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Аппаратный шагомер (Core Motion / Sensor.TYPE_STEP_COUNTER).
 * Системный датчик отфильтровывает тряску лучше, чем сырой акселерометр.
 */
export function useDevicePedometer() {
  const [active, setActive] = useState(false);
  const setStepsToday = useTrackerStore((s) => s.setStepsToday);
  const getStepsToday = useTrackerStore((s) => s.getStepsToday);

  const subRef = useRef<{ remove: () => void } | null>(null);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /** Шаги с полуночи до момента старта сессии (iOS) или сохранённое значение (Android). */
  const baseBeforeSessionRef = useRef(0);

  const stop = useCallback(() => {
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
      syncIntervalRef.current = null;
    }
    if (subRef.current) {
      subRef.current.remove();
      subRef.current = null;
    }
    setActive(false);
  }, []);

  const start = useCallback(async () => {
    if (subRef.current) return;

    const perm = await Pedometer.requestPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert(
        'Нет доступа',
        Platform.OS === 'android'
          ? 'Разрешите «Физическую активность» (Activity recognition) в настройках приложения.'
          : 'Разрешите доступ к данным о движении и фитнесу для подсчёта шагов.'
      );
      return;
    }

    const available = await Pedometer.isAvailableAsync();
    if (!available) {
      Alert.alert('Шагомер', 'На этом устройстве счётчик шагов недоступен.');
      return;
    }

    const sessionStart = new Date();
    let base = getStepsToday();

    if (Platform.OS === 'ios') {
      try {
        const { steps } = await Pedometer.getStepCountAsync(startOfToday(), sessionStart);
        base = Math.max(0, steps);
        setStepsToday(base);
      } catch {
        base = getStepsToday();
      }
    } else {
      base = Math.max(0, getStepsToday());
    }

    baseBeforeSessionRef.current = base;

    const sub = Pedometer.watchStepCount((result) => {
      const sessionSteps = Math.max(0, result.steps ?? 0);
      setStepsToday(baseBeforeSessionRef.current + sessionSteps);
    });

    subRef.current = sub;
    setActive(true);

    if (Platform.OS === 'ios') {
      syncIntervalRef.current = setInterval(async () => {
        if (!subRef.current) return;
        try {
          const { steps } = await Pedometer.getStepCountAsync(startOfToday(), new Date());
          const total = Math.max(0, steps);
          setStepsToday(Math.max(getStepsToday(), total));
        } catch {
          /* watchStepCount — основной источник */
        }
      }, 45_000);
    }
  }, [getStepsToday, setStepsToday]);

  useEffect(() => () => stop(), [stop]);

  const toggle = useCallback(() => {
    if (subRef.current) {
      stop();
    } else {
      void start();
    }
  }, [start, stop]);

  return { active, start, stop, toggle };
}
