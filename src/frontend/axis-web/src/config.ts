import type {
  ActivityStatus,
  GoalPriority,
  GoalStatus,
  JobApplicationStatus,
  JobStageStatus,
  JobWorkMode,
  LoadLevel,
  MetricValueType,
  MilestoneStatus,
  MilestoneType,
  ProgressType,
  RecurrenceFrequency
} from './types';

export type Page = 'today' | 'log' | 'focus' | 'jobs' | 'dashboard' | 'calendar'
  | 'countdowns' | 'physique' | 'journal' | 'history' | 'lessons' | 'money'
  | 'goals' | 'areas' | 'templates' | 'metrics' | 'wiki' | 'reviews' | 'backup';

export type CalendarView = 'day' | 'week' | 'month';

export const pages: Array<{ id: Page; label: string; kicker: string; icon: string }> = [
  { id: 'today', label: 'Today', kicker: 'Operate', icon: '//' },
  { id: 'log', label: 'Log', kicker: 'Capture', icon: '++' },
  { id: 'focus', label: 'Focus', kicker: 'Direction', icon: '::' },
  { id: 'jobs', label: 'Career Pipeline', kicker: 'Job search', icon: '//>' },
  { id: 'dashboard', label: 'Insights', kicker: 'Signals', icon: '==' },
  { id: 'calendar', label: 'Calendar', kicker: 'Plan', icon: '[]' },
  { id: 'countdowns', label: 'Countdowns', kicker: 'Anticipate', icon: '>>' },
  { id: 'physique', label: 'Physique', kicker: 'Body lab', icon: '^^' },
  { id: 'journal', label: 'Journal', kicker: 'Mind + diary', icon: '|>' },
  { id: 'history', label: 'History', kicker: 'Recall', icon: '<<' },
  { id: 'lessons', label: 'Life Lessons', kicker: 'Wisdom', icon: '**' },
  { id: 'money', label: 'Money', kicker: 'Capital', icon: '$$' },
  { id: 'goals', label: 'Goals', kicker: 'Outcomes', icon: '<>' },
  { id: 'areas', label: 'Life Areas', kicker: 'Balance', icon: '##' },
  { id: 'templates', label: 'Templates', kicker: 'Repeat', icon: '~~' },
  { id: 'metrics', label: 'Metrics', kicker: 'Signals', icon: '%%' },
  { id: 'wiki', label: 'Wiki', kicker: 'How-to', icon: '??' },
  { id: 'reviews', label: 'Reviews', kicker: 'Reflect', icon: '??' },
  { id: 'backup', label: 'Backup', kicker: 'Safety', icon: '!!' }
];

export const primaryPageIds: Page[] = [
  'today', 'log', 'focus', 'jobs', 'calendar', 'dashboard', 'goals', 'journal'
];

export const loadLevels: LoadLevel[] = ['Low', 'Medium', 'High'];
export const activityStatuses: ActivityStatus[] = ['Planned', 'Completed', 'Skipped', 'Moved', 'Cancelled'];
export const goalStatuses: GoalStatus[] = ['Active', 'Paused', 'Completed', 'Archived'];
export const goalPriorities: GoalPriority[] = ['Primary', 'Secondary', 'Maintenance'];
export const progressTypes: ProgressType[] = ['Manual', 'MilestoneBased', 'CountBased', 'MetricBased', 'Decay', 'Streak', 'Maintenance'];
export const milestoneTypes: MilestoneType[] = ['Count', 'Repetition', 'Binary', 'Metric', 'Checklist'];
export const milestoneStatuses: MilestoneStatus[] = ['Active', 'Completed', 'Paused', 'Archived'];
export const metricTypes: MetricValueType[] = ['Number', 'Percentage', 'Duration', 'Currency', 'Rating', 'Boolean'];
export const recurrenceFrequencies: RecurrenceFrequency[] = ['Daily', 'Weekly', 'Monthly'];
export const jobStatuses: JobApplicationStatus[] = ['Scouted', 'Shortlisted', 'Preparing', 'Applied', 'Interviewing', 'Offer', 'Accepted', 'Rejected', 'Withdrawn', 'Archived'];
export const jobWorkModes: JobWorkMode[] = ['OnSite', 'Hybrid', 'Remote'];
export const jobStageStatuses: JobStageStatus[] = ['Planned', 'Preparing', 'Scheduled', 'Completed', 'Cancelled'];

export const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const workoutMuscles = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Core'];
export const workoutMarker = '[axis-workout-v1]';
export const defaultPageSize = 12;
export const dashboardRanges = [
  { value: 1, label: '1D' },
  { value: 7, label: 'Week' },
  { value: 30, label: 'Month' },
  { value: 60, label: '2M' },
  { value: 180, label: '6M' }
];
