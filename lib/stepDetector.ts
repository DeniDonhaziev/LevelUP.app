/**
 * Детектор шагов по линейному ускорению (без GPS).
 * Сначала ждёт ритм ходьбы (3–4 шага подряд), потом считает — тряску отсекает.
 */

export type MotionSample = {
  ax: number;
  ay: number;
  az: number;
  /** рад/с — вспомогательно отсекает вращение телефона */
  gyroMag?: number;
  t: number;
};

export type StepDetectorOptions = {
  /** Мин. интервал между шагами (~2.2 шаг/с макс.) */
  minStepIntervalMs?: number;
  /** Макс. интервал (~0.65 шаг/с) */
  maxStepIntervalMs?: number;
  /** Сколько ритмичных «кандидатов» подряд, чтобы начать считать */
  rhythmStepsToArm?: number;
  /** Без шагов столько мс — снова ждать ритм */
  idleTimeoutMs?: number;
};

const DEFAULTS: Required<StepDetectorOptions> = {
  minStepIntervalMs: 380,
  maxStepIntervalMs: 1500,
  rhythmStepsToArm: 4,
  idleTimeoutMs: 4000,
};

class RingStats {
  private readonly buf: number[];
  private i = 0;
  private filled = 0;

  constructor(size: number) {
    this.buf = new Array(size).fill(0);
  }

  push(v: number) {
    this.buf[this.i] = v;
    this.i = (this.i + 1) % this.buf.length;
    if (this.filled < this.buf.length) this.filled++;
  }

  mean(): number {
    if (this.filled === 0) return 0;
    let s = 0;
    for (let k = 0; k < this.filled; k++) s += this.buf[k];
    return s / this.filled;
  }

  std(): number {
    if (this.filled < 2) return 0;
    const m = this.mean();
    let v = 0;
    for (let k = 0; k < this.filled; k++) {
      const d = this.buf[k] - m;
      v += d * d;
    }
    return Math.sqrt(v / this.filled);
  }
}

export class StepDetector {
  private readonly opts: Required<StepDetectorOptions>;

  private gx = 0;
  private gy = 0;
  private gz = 0;
  private hpPrev = 0;
  private hpPrevIn = 0;
  private bp = 0;

  private readonly energyRing = new RingStats(28);
  private readonly signalRing = new RingStats(14);

  private phase: 'idle' | 'rise' | 'fall' = 'idle';
  private peakValue = 0;
  private lastStepT = 0;
  private recentIntervals: number[] = [];
  private rhythmicCount = 0;
  /** true = идёт ходьба, можно считать шаги */
  private armed = false;
  private jitterPeaks = 0;
  private jitterWindowStart = 0;
  private lastSampleT = 0;
  private burstPeaks = 0;
  private burstWindowStart = 0;

  constructor(options?: StepDetectorOptions) {
    this.opts = { ...DEFAULTS, ...options };
  }

  reset() {
    this.phase = 'idle';
    this.peakValue = 0;
    this.lastStepT = 0;
    this.recentIntervals = [];
    this.rhythmicCount = 0;
    this.armed = false;
    this.jitterPeaks = 0;
    this.jitterWindowStart = 0;
    this.burstPeaks = 0;
    this.burstWindowStart = 0;
    this.lastSampleT = 0;
    this.hpPrev = 0;
    this.hpPrevIn = 0;
    this.bp = 0;
  }

  private gravityAlpha(dtMs: number): number {
    const dt = Math.min(80, Math.max(8, dtMs)) / 1000;
    return Math.exp(-dt * 4.5);
  }

  private filterLinear(ax: number, ay: number, az: number, dtMs: number): number {
    const a = this.gravityAlpha(dtMs);
    this.gx = a * this.gx + (1 - a) * ax;
    this.gy = a * this.gy + (1 - a) * ay;
    this.gz = a * this.gz + (1 - a) * az;
    const lx = ax - this.gx;
    const ly = ay - this.gy;
    const lz = az - this.gz;
    return Math.sqrt(lx * lx + ly * ly + lz * lz);
  }

  /** полоса ~0.5–3 Гц — типичный шаг */
  private bandPass(mag: number): number {
    const hp = 0.86 * (this.hpPrev + mag - this.hpPrevIn);
    this.hpPrev = hp;
    this.hpPrevIn = mag;
    this.bp = this.bp * 0.72 + hp * 0.28;
    return this.bp;
  }

  private isRhythmicInterval(dt: number): boolean {
    if (dt < this.opts.minStepIntervalMs || dt > this.opts.maxStepIntervalMs) return false;
    if (this.recentIntervals.length === 0) return false;
    const sorted = [...this.recentIntervals].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] ?? dt;
    const ratio = dt / median;
    return ratio >= 0.6 && ratio <= 1.7;
  }

  private recordJitterPeak(now: number) {
    if (now - this.jitterWindowStart > 450) {
      this.jitterWindowStart = now;
      this.jitterPeaks = 0;
    }
    this.jitterPeaks++;
  }

  private recordBurstPeak(now: number) {
    if (now - this.burstWindowStart > 1000) {
      this.burstWindowStart = now;
      this.burstPeaks = 0;
    }
    this.burstPeaks++;
  }

  /** Слишком много мелких пиков = тряска, не ходьба */
  private isShakeBurst(now: number): boolean {
    if (now - this.burstWindowStart > 1000) return false;
    return this.burstPeaks >= 9;
  }

  private isShakeJitter(now: number): boolean {
    if (now - this.jitterWindowStart > 450) return false;
    return this.jitterPeaks >= 4;
  }

  private isRotationShake(gyroMag: number | undefined): boolean {
    if (gyroMag == null) return false;
    return gyroMag > (this.armed ? 5.5 : 3.2);
  }

  /**
   * Обработка кандидата в шаг (пик прошёл порог).
   * До armed — только накапливаем ритм, шаги не считаем.
   */
  private onStepCandidate(now: number, prominence: number, gyroMag?: number): 0 | 1 {
    if (this.isRotationShake(gyroMag)) return 0;
    if (this.isShakeBurst(now) || this.isShakeJitter(now)) {
      this.rhythmicCount = 0;
      this.armed = false;
      return 0;
    }

    const dt = this.lastStepT > 0 ? now - this.lastStepT : this.opts.maxStepIntervalMs;
    if (this.lastStepT > 0 && now - this.lastStepT < this.opts.minStepIntervalMs) return 0;

    const noise = Math.max(0.1, this.energyRing.std());
    const minProm = this.armed ? noise * 1.5 + 0.14 : noise * 2.4 + 0.28;
    if (prominence < minProm) return 0;

    const rhythmic = this.isRhythmicInterval(dt);

    if (!this.armed) {
      if (!rhythmic && this.recentIntervals.length > 0) {
        this.rhythmicCount = Math.max(0, this.rhythmicCount - 1);
        return 0;
      }
      if (rhythmic || this.recentIntervals.length === 0) {
        this.rhythmicCount++;
      }
      if (this.lastStepT > 0) {
        this.recentIntervals = [...this.recentIntervals, dt].slice(-5);
      }
      this.lastStepT = now;
      if (this.rhythmicCount >= this.opts.rhythmStepsToArm) {
        this.armed = true;
      }
      return 0;
    }

    if (!rhythmic) {
      this.rhythmicCount = Math.max(0, this.rhythmicCount - 1);
      if (this.rhythmicCount < 2) return 0;
    } else {
      this.rhythmicCount = Math.min(this.opts.rhythmStepsToArm + 2, this.rhythmicCount + 1);
    }

    this.lastStepT = now;
    this.recentIntervals = [...this.recentIntervals, dt].slice(-5);
    return 1;
  }

  process(sample: MotionSample): 0 | 1 {
    const now = sample.t;
    const dtMs =
      this.lastSampleT > 0 ? Math.min(120, Math.max(5, now - this.lastSampleT)) : 16;
    this.lastSampleT = now;

    const mag = this.filterLinear(sample.ax, sample.ay, sample.az, dtMs);
    const sig = this.bandPass(mag);
    this.energyRing.push(mag);
    this.signalRing.push(Math.abs(sig));

    const mean = this.signalRing.mean();
    const std = this.signalRing.std();
    const threshold = mean + Math.max(0.16, std * 1.25);

    if (this.armed && this.lastStepT > 0 && now - this.lastStepT > this.opts.idleTimeoutMs) {
      this.armed = false;
      this.rhythmicCount = 0;
      this.recentIntervals = [];
    }

    if (Math.abs(sig) > threshold * 0.35) {
      this.recordBurstPeak(now);
    }
    if (sig > threshold * 0.5 && sig < threshold * 0.95) {
      this.recordJitterPeak(now);
    }

    let step: 0 | 1 = 0;

    if (this.phase === 'idle' || this.phase === 'fall') {
      if (sig > threshold) {
        this.phase = 'rise';
        this.peakValue = sig;
      }
    } else if (this.phase === 'rise') {
      if (sig > this.peakValue) this.peakValue = sig;
      if (sig < threshold * 0.38) {
        if (this.peakValue >= threshold) {
          const prominence = this.peakValue - mean;
          step = this.onStepCandidate(now, prominence, sample.gyroMag);
        }
        this.phase = 'idle';
        this.peakValue = 0;
      }
    }

    return step;
  }
}
