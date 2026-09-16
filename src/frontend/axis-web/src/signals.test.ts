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
    expect(track.days.map((day) => day.status)).toEqual(['missed', 'done']);
    expect(track.completedCount).toBe(1);
    expect(track.missedCount).toBe(1);
    expect(track.minutes).toBe(5);
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
