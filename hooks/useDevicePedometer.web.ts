import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { StepDetector } from '@/lib/stepDetector';
import { useTrackerStore } from '@/store/trackerStore';

type MotionWithRequest = {
  requestPermission?: () => Promise<'granted' | 'denied'>;
};

/**
 * Веб/PWA-шагомер: только акселерометр, без GPS.
 * Шаги считаются после 4 ритмичных ударов (ходьба), тряску отсекает.
 */
export function useDevicePedometer() {
  const [active, setActive] = useState(false);
  const setStepsToday = useTrackerStore((s) => s.setStepsToday);
  const getStepsToday = useTrackerStore((s) => s.getStepsToday);

  const listenerRef = useRef<((e: DeviceMotionEvent) => void) | null>(null);
  const detectorRef = useRef<StepDetector | null>(null);
  const stepsAccRef = useRef(0);

  const stop = useCallback(() => {
    if (listenerRef.current) {
      window.removeEventListener('devicemotion', listenerRef.current as EventListener);
      listenerRef.current = null;
    }
    detectorRef.current = null;
    stepsAccRef.current = 0;
    setActive(false);
  }, []);

  const flushSteps = useCallback(() => {
    const n = stepsAccRef.current;
    if (n <= 0) return;
    stepsAccRef.current = 0;
    setStepsToday(getStepsToday() + n);
  }, [getStepsToday, setStepsToday]);

  const start = useCallback(async () => {
    if (listenerRef.current) return;
    if (typeof window === 'undefined' || typeof DeviceMotionEvent === 'undefined') {
      Alert.alert('Шагомер', 'Датчик движения недоступен в этом браузере.');
      return;
    }

    const Motion = DeviceMotionEvent as unknown as MotionWithRequest;
    if (typeof Motion.requestPermission === 'function') {
      try {
        const perm = await Motion.requestPermission();
        if (perm !== 'granted') {
          Alert.alert('Шагомер', 'Разрешите доступ к датчику движения.');
          return;
        }
      } catch {
        Alert.alert('Шагомер', 'Не удалось запросить доступ к движению.');
        return;
      }
    }

    const detector = new StepDetector({
      minStepIntervalMs: 380,
      rhythmStepsToArm: 4,
      idleTimeoutMs: 4000,
    });
    detectorRef.current = detector;
    stepsAccRef.current = 0;

    const onMotion = (e: DeviceMotionEvent) => {
      const raw = e.accelerationIncludingGravity ?? e.acceleration;
      if (!raw) return;

      const ax = raw.x ?? 0;
      const ay = raw.y ?? 0;
      const az = raw.z ?? 0;

      let gyroMag: number | undefined;
      const rot = e.rotationRate;
      if (rot) {
        const rx = rot.alpha ?? 0;
        const ry = rot.beta ?? 0;
        const rz = rot.gamma ?? 0;
        gyroMag = Math.sqrt(rx * rx + ry * ry + rz * rz);
      }

      const step = detector.process({
        ax,
        ay,
        az,
        gyroMag,
        t: e.timeStamp > 0 ? e.timeStamp : Date.now(),
      });

      if (step === 1) {
        stepsAccRef.current += 1;
        flushSteps();
      }
    };

    listenerRef.current = onMotion;
    window.addEventListener('devicemotion', onMotion as EventListener);
    setActive(true);
  }, [flushSteps]);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(flushSteps, 2000);
    return () => clearInterval(id);
  }, [active, flushSteps]);

  useEffect(() => () => stop(), [stop]);

  const toggle = useCallback(() => {
    if (active) stop();
    else void start();
  }, [active, start, stop]);

  return { active, start, stop, toggle };
}
