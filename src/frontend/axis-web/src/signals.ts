import type { Activity, ActivityTemplate } from './types';

export type TrackDayStatus = 'done' | 'missed' | 'planned' | 'skipped' | 'empty';

export interface DashboardTrack {
  title: string;
  cadence: string;
  template?: ActivityTemplate;
  days: Array<{ key: string; label: string; status: TrackDayStatus }>;
  completedCount: number;
  expectedCount: number;
  missedCount: number;
  minutes: number;
}

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function getActivityDate(activity: Activity) {
  return activity.plannedStartAt ?? activity.actualStartAt;
}

function sameDay(value: string | undefined, date: Date) {
  return value ? new Date(value).toDateString() === date.toDateString() : false;
}

export function getDayStatus(activities: Activity[], flexible: boolean, day: Date): TrackDayStatus {
  const today = startOfDay(new Date());
  if (activities.some((activity) => activity.status === 'Completed')) return 'done';
  if (activities.some((activity) => activity.status === 'Skipped' || activity.status === 'Cancelled')) return 'skipped';
  if (activities.some((activity) => activity.status === 'Planned' || activity.status === 'Moved')) return 'planned';
  if (!flexible && startOfDay(day).getTime() < today.getTime()) return 'missed';
  return 'empty';
}

export function buildDashboardTracks(days: Date[], activities: Activity[], templates: ActivityTemplate[]): DashboardTrack[] {
  const flexibleTitles = new Set(['DSA problem rep', 'System design case study']);

  return templates.map((template) => {
    const flexible = flexibleTitles.has(template.title);
    const related = activities.filter((activity) => activity.templateId === template.id || activity.title === template.title);
    const trackDays = days.map((day) => {
      const status = getDayStatus(related.filter((activity) => sameDay(getActivityDate(activity), day)), flexible, day);
      return { key: dateKey(day), label: day.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), status };
    });
    const completedCount = related.filter((activity) => activity.status === 'Completed').length;
    const missedCount = trackDays.filter((day) => day.status === 'missed' || day.status === 'skipped').length;
    const today = startOfDay(new Date());
    const expectedCount = flexible
      ? Math.max(completedCount, related.length)
      : trackDays.filter((trackDay, index) => trackDay.status !== 'empty' || startOfDay(days[index]).getTime() < today.getTime()).length;

    return {
      title: template.title,
      cadence: flexible ? 'Log when you study' : 'Recurring baseline',
      template,
      days: trackDays,
      completedCount,
      expectedCount,
      missedCount,
      minutes: related.filter((activity) => activity.status === 'Completed').reduce((sum, activity) => sum + activity.durationMinutes, 0)
    };
  });
}
