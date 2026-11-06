import { describe, expect, it } from 'vitest';
import {
  assessSleepDuration,
  formatSleepDuration,
  normalizeSleepHours,
  sleepHoursFromParts,
  splitSleepDuration
} from './sleep';

describe('sleep helpers', () => {
  it('keeps minute precision without changing the stored decimal-hour format', () => {
    expect(sleepHoursFromParts(7, 20)).toBeCloseTo(7.3333, 3);
    expect(splitSleepDuration(7.3333)).toEqual({ hours: 7, minutes: 20 });
    expect(formatSleepDuration(7.3333)).toBe('7h 20m');
  });

  it('limits values to one day', () => {
    expect(normalizeSleepHours(-2)).toBe(0);
    expect(normalizeSleepHours(30)).toBe(24);
  });

  it('formats signed differences', () => {
    expect(formatSleepDuration(-0.5)).toBe('-30m');
  });

  it('keeps the established sleep guidance thresholds', () => {
    expect(assessSleepDuration(8).label).toBe('Optimal target zone');
    expect(assessSleepDuration(6.5).tone).toBe('warning');
    expect(assessSleepDuration(5).tone).toBe('danger');
  });
});
