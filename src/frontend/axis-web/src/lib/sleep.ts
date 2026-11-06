export type SleepAssessment = {
  label: string;
  tone: 'good' | 'okay' | 'warning' | 'danger';
  copy: string;
};

export function normalizeSleepHours(value: number) {
  return Math.round(clamp(value, 0, 24) * 60) / 60;
}

export function splitSleepDuration(value: number) {
  const totalMinutes = Math.round(normalizeSleepHours(value) * 60);
  return {
    hours: Math.floor(totalMinutes / 60),
    minutes: totalMinutes % 60
  };
}

export function sleepHoursFromParts(hours: number, minutes: number) {
  const safeHours = clamp(Math.trunc(hours || 0), 0, 24);
  const safeMinutes = clamp(Math.trunc(minutes || 0), 0, 59);
  return normalizeSleepHours(safeHours + safeMinutes / 60);
}

export function formatSleepDuration(value: number) {
  const sign = value < 0 ? '-' : '';
  const totalMinutes = Math.round(Math.abs(value) * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (minutes === 0) return `${sign}${hours}h`;
  if (hours === 0) return `${sign}${minutes}m`;
  return `${sign}${hours}h ${minutes}m`;
}

export function assessSleepDuration(value: number): SleepAssessment {
  const minutes = Math.round(value * 60);

  if (minutes >= 540) {
    return assessment('Long recovery night', 'good', 'This can be useful during recovery or after accumulated sleep debt; watch the weekly pattern.');
  }
  if (minutes >= 480) {
    return assessment('Optimal target zone', 'good', 'You reached the 8-hour recovery target.');
  }
  if (minutes >= 450) {
    return assessment('Close to target', 'okay', 'A solid night, slightly below the 8-hour target.');
  }
  if (minutes >= 420) {
    return assessment('Minimum healthy range', 'okay', 'Seven or more hours meets the adult baseline, but leaves less recovery buffer than your 8-hour target.');
  }
  if (minutes >= 360) {
    return assessment('Short night', 'warning', 'Below seven hours. Training quality, attention, appetite control, and mood may be less resilient.');
  }

  return assessment('Severe shortfall', 'danger', 'Prioritize recovery today and avoid turning this into a repeated pattern.');
}

function assessment(label: string, tone: SleepAssessment['tone'], copy: string): SleepAssessment {
  return { label, tone, copy };
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}
