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
  | 'goals' | 'roadmaps' | 'areas' | 'templates' | 'metrics' | 'wiki' | 'reviews' | 'backup';

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
  { id: 'roadmaps', label: 'Roadmaps', kicker: 'Navigate', icon: '/~' },
  { id: 'areas', label: 'Life Areas', kicker: 'Balance', icon: '##' },
  { id: 'templates', label: 'Templates', kicker: 'Repeat', icon: '~~' },
  { id: 'metrics', label: 'Metrics', kicker: 'Signals', icon: '%%' },
  { id: 'wiki', label: 'Wiki', kicker: 'How-to', icon: '??' },
  { id: 'reviews', label: 'Reviews', kicker: 'Reflect', icon: '??' },
  { id: 'backup', label: 'Backup', kicker: 'Safety', icon: '!!' }
];

export const primaryPageIds: Page[] = [
  'today', 'log', 'dashboard', 'calendar', 'goals', 'journal'
];

export const mobilePageIds: Page[] = ['today', 'log', 'dashboard', 'calendar'];

export const pageGroups: Array<{ label: string; description: string; pageIds: Page[] }> = [
  {
    label: 'Operate',
    description: 'Act, capture and plan',
    pageIds: ['today', 'log', 'focus', 'calendar', 'countdowns']
  },
  {
    label: 'Understand',
    description: 'See patterns and history',
    pageIds: ['dashboard', 'metrics', 'physique', 'journal', 'history', 'reviews']
  },
  {
    label: 'Build',
    description: 'Shape outcomes and systems',
    pageIds: ['goals', 'roadmaps', 'areas', 'templates']
  },
  {
    label: 'Life',
    description: 'Career, money and wisdom',
    pageIds: ['jobs', 'money', 'lessons', 'wiki']
  },
  {
    label: 'System',
    description: 'Protect and maintain Axis',
    pageIds: ['backup']
  }
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
