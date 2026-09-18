import type { Activity, ActivityTemplate, RecurrenceRule } from './types';

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
  kind: 'duration' | 'checkin' | 'quantity';
  quantityTotal: number;
  quantityUnit: string;
}

const checkInTitles = new Set([
  'Creatine dose',
  'Desk mobility reset',
  'No alcohol check-in',
  'No vape check-in',
  'Diet check-in',
  'SPF 30+',
  'Night retinoid',
  'Floss teeth'
]);

function trackKind(title: string): DashboardTrack['kind'] {
  if (title === 'Sleep log') return 'quantity';
  return checkInTitles.has(title) ? 'checkin' : 'duration';
}

function loggedQuantity(activity: Activity) {
  return Number(activity.notes.match(/Quantity:\s*([0-9.]+)/i)?.[1] ?? 0);
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

export function getDayStatus(activities: Activity[], flexible: boolean, day: Date, activeFrom?: Date): TrackDayStatus {
  const today = startOfDay(new Date());
  if (activeFrom && startOfDay(day).getTime() < startOfDay(activeFrom).getTime()) return 'empty';
  if (activities.some((activity) => activity.status === 'Completed')) return 'done';
  if (activities.some((activity) => activity.status === 'Skipped' || activity.status === 'Cancelled')) return 'skipped';
  if (activities.some((activity) => activity.status === 'Planned' || activity.status === 'Moved')) return 'planned';
  if (!flexible && startOfDay(day).getTime() < today.getTime()) return 'missed';
  return 'empty';
}

export function buildDashboardTracks(days: Date[], activities: Activity[], templates: ActivityTemplate[], rules: RecurrenceRule[] = []): DashboardTrack[] {
  const flexibleTitles = new Set(['DSA problem rep', 'System design case study']);

  return templates.map((template) => {
    const flexible = flexibleTitles.has(template.title);
    const kind = trackKind(template.title);
    const related = activities.filter((activity) => activity.templateId === template.id || activity.title === template.title);
    const starts = rules.filter((rule) => rule.templateId === template.id).map((rule) => new Date(`${rule.startDate}T00:00:00`));
    related.forEach((activity) => { const value = getActivityDate(activity); if (value) starts.push(new Date(value)); });
    const activeFrom = starts.length ? new Date(Math.min(...starts.map((value) => value.getTime()))) : new Date();
    const trackDays = days.map((day) => {
      const status = getDayStatus(related.filter((activity) => sameDay(getActivityDate(activity), day)), flexible, day, activeFrom);
      return { key: dateKey(day), label: day.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), status };
    });
    const completedCount = related.filter((activity) => activity.status === 'Completed').length;
    const missedCount = trackDays.filter((day) => day.status === 'missed' || day.status === 'skipped').length;
    const today = startOfDay(new Date());
    const expectedCount = flexible
      ? Math.max(completedCount, related.length)
      : trackDays.filter((trackDay, index) => trackDay.status !== 'empty' || (startOfDay(days[index]).getTime() >= startOfDay(activeFrom).getTime() && startOfDay(days[index]).getTime() < today.getTime())).length;

    return {
      title: template.title,
      cadence: flexible ? 'Log when you study' : 'Recurring baseline',
      template,
      days: trackDays,
      completedCount,
      expectedCount,
      missedCount,
      minutes: kind === 'duration' ? related.filter((activity) => activity.status === 'Completed').reduce((sum, activity) => sum + activity.durationMinutes, 0) : 0,
      kind,
      quantityTotal: kind === 'quantity' ? related.filter((activity) => activity.status === 'Completed').reduce((sum, activity) => sum + loggedQuantity(activity), 0) : 0,
      quantityUnit: kind === 'quantity' ? 'h' : ''
    };
  });
}
