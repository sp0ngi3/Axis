import { describe, expect, it, vi } from 'vitest';
import { buildDashboardTracks } from './signals';
import type { Activity, ActivityTemplate } from './types';

const template: ActivityTemplate = {
  id: 'creatine-template',
  lifeAreaId: 'health',
  lifeAreaName: 'Health',
  lifeAreaColor: '#36d7e8',
  title: 'Creatine dose',
  description: '',
  defaultDurationMinutes: 5,
  energyCost: 'Low',
  mentalLoad: 'Low',
  physicalLoad: 'Low',
  defaultPoints: 4,
  isActive: true
};

function completedActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: 'activity-1',
    lifeAreaId: 'health',
    lifeAreaName: 'Health',
    lifeAreaColor: '#36d7e8',
    templateId: template.id,
    title: template.title,
    description: '',
    plannedStartAt: '2026-09-16T08:00:00+02:00',
    plannedEndAt: '2026-09-16T08:05:00+02:00',
    actualStartAt: '2026-09-16T08:00:00+02:00',
    actualEndAt: '2026-09-16T08:05:00+02:00',
    durationMinutes: 5,
    status: 'Completed',
    energyCost: 'Low',
    mentalLoad: 'Low',
    physicalLoad: 'Low',
    points: 4,
    notes: '',
    ...overrides
  };
}

describe('Signals dashboard aggregation', () => {
  it('maps completed activity to the same date key used by the visual trend', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-16T12:00:00+02:00'));
    const days = [new Date('2026-09-15T12:00:00+02:00'), new Date('2026-09-16T12:00:00+02:00')];

    const [track] = buildDashboardTracks(days, [completedActivity()], [template]);

    expect(track.days.map((day) => day.key)).toEqual(['2026-8-15', '2026-8-16']);
    expect(track.days.map((day) => day.status)).toEqual(['empty', 'done']);
    expect(track.completedCount).toBe(1);
    expect(track.missedCount).toBe(0);
    expect(track.kind).toBe('checkin');
    expect(track.minutes).toBe(0);
    vi.useRealTimers();
  });

  it('keeps quantity logs separate from time and check-ins', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-16T12:00:00+02:00'));
    const sleepTemplate = { ...template, id: 'sleep-template', title: 'Sleep log', defaultDurationMinutes: 1 };
    const sleep = completedActivity({ templateId: sleepTemplate.id, title: sleepTemplate.title, durationMinutes: 1, notes: 'Quantity: 7.5' });

    const [track] = buildDashboardTracks([new Date('2026-09-16T12:00:00+02:00')], [sleep], [sleepTemplate]);

    expect(track.kind).toBe('quantity');
    expect(track.quantityTotal).toBe(7.5);
    expect(track.quantityUnit).toBe('h');
    expect(track.minutes).toBe(0);
    vi.useRealTimers();
  });

  it('labels steps, water, and nutrition without treating them as focused minutes', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-16T12:00:00+02:00'));
    const stepsTemplate = { ...template, id: 'steps-template', title: 'Steps', defaultDurationMinutes: 1 };
    const waterTemplate = { ...template, id: 'water-template', title: 'Water intake', defaultDurationMinutes: 1 };
    const nutritionTemplate = { ...template, id: 'nutrition-template', title: 'Daily nutrition', defaultDurationMinutes: 1 };
    const rows = [
      completedActivity({ id: 'steps', templateId: stepsTemplate.id, title: stepsTemplate.title, notes: 'Quantity: 10432' }),
      completedActivity({ id: 'water', templateId: waterTemplate.id, title: waterTemplate.title, notes: 'Quantity: 2700' }),
      completedActivity({ id: 'nutrition', templateId: nutritionTemplate.id, title: nutritionTemplate.title, notes: 'Calories: 2200' })
    ];

    const tracks = buildDashboardTracks([new Date('2026-09-16T12:00:00+02:00')], rows, [stepsTemplate, waterTemplate, nutritionTemplate]);

    expect(tracks[0]).toMatchObject({ kind: 'quantity', quantityTotal: 10432, quantityUnit: 'steps', minutes: 0 });
    expect(tracks[1]).toMatchObject({ kind: 'quantity', quantityTotal: 2700, quantityUnit: 'ml', minutes: 0 });
    expect(tracks[2]).toMatchObject({ kind: 'checkin', quantityTotal: 0, minutes: 0 });
    vi.useRealTimers();
  });

  it('only marks missed days after tracking was activated', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-16T12:00:00+02:00'));
    const days = [new Date('2026-09-13T12:00:00+02:00'), new Date('2026-09-15T12:00:00+02:00')];
    const rules = [{ id: 'rule', templateId: template.id, templateTitle: template.title, lifeAreaName: 'Health', lifeAreaColor: '#fff', frequency: 'Daily' as const, interval: 1, daysOfWeek: '', startDate: '2026-09-14' }];
    const [track] = buildDashboardTracks(days, [], [template], rules);
    expect(track.days.map((day) => day.status)).toEqual(['empty', 'missed']);
    vi.useRealTimers();
  });

  it('does not turn empty flexible study days into failures', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-16T12:00:00+02:00'));
    const studyTemplate = { ...template, id: 'dsa-template', title: 'DSA problem rep', defaultDurationMinutes: 45 };
    const days = [new Date('2026-09-14T12:00:00+02:00'), new Date('2026-09-15T12:00:00+02:00')];

    const [track] = buildDashboardTracks(days, [], [studyTemplate]);

    expect(track.days.every((day) => day.status === 'empty')).toBe(true);
    expect(track.missedCount).toBe(0);
    expect(track.cadence).toBe('Log when you study');
    vi.useRealTimers();
  });
});
