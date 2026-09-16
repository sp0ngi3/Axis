export type LoadLevel = 'Low' | 'Medium' | 'High';
export type ActivityStatus = 'Planned' | 'Completed' | 'Skipped' | 'Moved' | 'Cancelled';
export type GoalStatus = 'Active' | 'Paused' | 'Completed' | 'Archived';
export type GoalPriority = 'Primary' | 'Secondary' | 'Maintenance';
export type ProgressType = 'Manual' | 'MilestoneBased' | 'CountBased' | 'MetricBased' | 'Decay' | 'Streak' | 'Maintenance';
export type MilestoneType = 'Count' | 'Repetition' | 'Binary' | 'Metric' | 'Checklist';
export type MilestoneStatus = 'Active' | 'Completed' | 'Paused' | 'Archived';
export type MetricValueType = 'Number' | 'Percentage' | 'Duration' | 'Currency' | 'Rating' | 'Boolean';
export type RecurrenceFrequency = 'Daily' | 'Weekly' | 'Monthly';

export interface LifeArea {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  priorityWeight: number;
  currentScore: number;
  targetScore: number;
  isActive: boolean;
}

export interface Goal {
  id: string;
  lifeAreaId: string;
  lifeAreaName: string;
  lifeAreaColor: string;
  title: string;
  description: string;
  status: GoalStatus;
  priority: GoalPriority;
  progressType: ProgressType;
  currentValue: number;
  targetValue: number;
  unit: string;
  targetDate?: string;
  maintenanceThreshold: number;
  maintenanceTargetPerWeek?: number | null;
  decayRatePercentPerWeek: number;
  milestones: Milestone[];
}

export interface Milestone {
  id: string;
  goalId: string;
  title: string;
  description: string;
  type: MilestoneType;
  currentValue: number;
  targetValue: number;
  unit: string;
  progress: number;
  sortOrder: number;
  status: MilestoneStatus;
  dueDate?: string;
}

export interface Activity {
  id: string;
  lifeAreaId: string;
  lifeAreaName: string;
  lifeAreaColor: string;
  goalId?: string;
  goalTitle?: string;
  milestoneId?: string | null;
  templateId?: string | null;
  title: string;
  description: string;
  plannedStartAt?: string;
  plannedEndAt?: string;
  actualStartAt?: string;
  actualEndAt?: string;
  durationMinutes: number;
  status: ActivityStatus;
  energyCost: LoadLevel;
  mentalLoad: LoadLevel;
  physicalLoad: LoadLevel;
  points: number;
  notes: string;
}

export interface ActivityTemplate {
  id: string;
  lifeAreaId: string;
  lifeAreaName: string;
  lifeAreaColor: string;
  title: string;
  description: string;
  defaultDurationMinutes: number;
  energyCost: LoadLevel;
  mentalLoad: LoadLevel;
  physicalLoad: LoadLevel;
  defaultPoints: number;
  isActive: boolean;
}

export interface RecurrenceRule {
  id: string;
  templateId: string;
  templateTitle: string;
  lifeAreaName: string;
  lifeAreaColor: string;
  frequency: RecurrenceFrequency;
  interval: number;
  daysOfWeek: string;
  startDate: string;
  endDate?: string | null;
}

export interface Metric {
  id: string;
  lifeAreaId?: string | null;
  goalId?: string | null;
  name: string;
  unit: string;
  valueType: MetricValueType;
  targetValue?: number | null;
  isActive: boolean;
  latestEntry?: MetricEntry | null;
}

export interface MetricEntry {
  id: string;
  metricId: string;
  value: number;
  recordedAt: string;
  notes: string;
}

export interface Review {
  id: string;
  type: 'Weekly' | 'Monthly';
  periodStart: string;
  periodEnd: string;
  summary: string;
  whatWorked: string;
  whatDidNotWork: string;
  nextFocus: string;
  insights: Array<{ id: string; message: string; severity: string }>;
}

export interface TodayDashboard {
  date: string;
  primaryGoal?: Goal;
  mainFocus?: Activity;
  supportTasks: Activity[];
  recoveryTask?: Activity;
  timeline: Activity[];
  suggestion: string;
}

export interface Suggestion {
  kind: string;
  title: string;
  reason: string;
  activity?: Activity;
  goal?: Goal;
  lifeAreaId?: string;
}

export interface OverviewDashboard {
  activeGoals: number;
  completedThisWeek: number;
  primaryGoal?: Goal;
  message: string;
}

export interface BalanceRow {
  lifeAreaId: string;
  name: string;
  color: string;
  priorityWeight: number;
  minutes: number;
  hours: number;
  count: number;
  percent: number;
  targetPercent: number;
  plannedMinutes: number;
  completedMinutes: number;
  skippedMinutes: number;
  plannedCount: number;
  completedCount: number;
  skippedCount: number;
  attentionGapPercent: number;
  signal: 'Neglected' | 'Overloaded' | 'Balanced';
  days: BalanceDay[];
}

export interface BalanceDay {
  date: string;
  plannedMinutes: number;
  completedMinutes: number;
  skippedCount: number;
}

export interface BackupStatus {
  databaseExists: boolean;
  databasePath: string;
  backupDirectory: string;
  recentBackups: string[];
}

export interface BackupValidation {
  isValid: boolean;
  message: string;
  manifest?: {
    appName: string;
    appVersion: string;
    schemaVersion: number;
    exportedAt: string;
    databaseFileName: string;
  } | null;
}

export interface BackupImportResult {
  imported: boolean;
  message: string;
  preImportBackupFileName?: string | null;
  validation: BackupValidation;
}
