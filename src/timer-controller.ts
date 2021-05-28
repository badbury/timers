const durationInMs = {
  millisecond: 1,
  second: 1000,
  minute: 60 * 1000,
  hour: 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
  month: 30 * 60 * 60 * 1000,
} as const;

export interface ChainableDuration {
  and: DurationFunction;
}

export interface DurationFunction<R = ChainableDuration> {
  (unit: 'minute'): R;
  (duration: number, unit: 'minutes'): R;
  (unit: 'second'): R;
  (duration: number, unit: 'seconds'): R;
  (unit: 'millisecond'): R;
  (duration: number, unit: 'milliseconds'): R;
  (unit: 'hour'): R;
  (duration: number, unit: 'hours'): R;
  (unit: 'day'): R;
  (duration: number, unit: 'days'): R;
  (unit: 'month'): R;
  (duration: number, unit: 'months'): R;
}

export const durationToMs: DurationFunction<number> = function durationToMs(
  duration: number | string,
  unit?: string,
) {
  if (typeof unit === 'undefined') {
    return durationInMs[duration as keyof typeof durationInMs];
  }
  return durationInMs[unit?.slice(0, -1) as keyof typeof durationInMs] * (duration as number);
};

export type TimerOptions = {
  intervalInMs?: number;
  limitRuns?: number;
  pointer?: NodeJS.Timeout | number | undefined;
  handler?: () => unknown;
};

export class Timer implements ChainableDuration {
  intervalInMs: TimerOptions['intervalInMs'] = 0;
  limitRuns?: TimerOptions['limitRuns'];
  pointer?: TimerOptions['pointer'];
  handler?: TimerOptions['handler'];
  // public stopSubject?: { prototype: unknown };
  // public startSubject?: { prototype: unknown };

  constructor(public options: TimerOptions = {}) {
    Object.assign(this, options);
  }

  and: DurationFunction<Timer> = (...args: unknown[]): Timer => {
    const [duration, unit] = args as [number, 'months'];
    const intervalInMs = (this.intervalInMs || 0) + durationToMs(duration, unit);
    return this.extend({ intervalInMs });
  };

  limit(limitRuns: TimerOptions['limitRuns']): Timer {
    return this.extend({ limitRuns });
  }

  do(handler: TimerOptions['handler']): Timer {
    return this.extend({ handler });
  }

  // stopOn(stopSubject: { prototype: unknown }): Timer {
  //   return this.extend({ stopSubject });
  // }

  // startOn(startSubject: { prototype: unknown }): Timer {
  //   return this.extend({ startSubject });
  // }

  stop(): void {
    if (!this.pointer) {
      return;
    }
    clearInterval(this.pointer as NodeJS.Timeout);
    this.pointer = undefined;
  }

  start(): void {
    this.pointer = setInterval(this.handle, this.intervalInMs);
  }

  handle = async (): Promise<void> => {
    this.registerRun();
    if (this.handler) {
      await this.handler();
    }
  };

  private registerRun(): void {
    if (typeof this.limitRuns === 'undefined') {
      return;
    }
    this.limitRuns = this.limitRuns - 1;
    if (this.limitRuns <= 0 && this.pointer) {
      this.stop();
      this.limitRuns = undefined;
    }
  }

  public export(): TimerOptions {
    return {
      intervalInMs: this.intervalInMs,
      limitRuns: this.limitRuns,
      pointer: this.pointer,
      handler: this.handler,
    };
  }

  private extend(options: Partial<TimerOptions>) {
    return new Timer({
      ...this.export(),
      ...options,
    });
  }
}

new Timer({ handler: () => 123, intervalInMs: 1 });

export class TimerController {
  protected timers: Timer[] = [];

  use(timer: Timer): TimerController {
    this.timers.push(timer);
    return this;
  }

  start(): void {
    for (const timer of this.timers) {
      timer.start();
    }
  }

  stop(): void {
    for (const timer of this.timers) {
      timer.stop();
    }
  }
}

export const every: DurationFunction<Timer> = function (...args: unknown[]) {
  const [duration, unit] = args as [number, 'months'];
  return new Timer().and(duration, unit);
};
