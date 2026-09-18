import { ChangeEvent, FormEvent, Fragment, type CSSProperties, type ReactNode, useEffect, useMemo, useState } from 'react';
import { api } from './api';
import { buildDashboardTracks, getDayStatus } from './signals';
import type { DashboardTrack } from './signals';
import type {
  Activity,
  ActivityTemplate,
  ActivityStatus,
  BackupImportResult,
  BackupStatus,
  BackupValidation,
  BalanceRow,
  Countdown,
  Goal,
  GoalProgress,
  GoalPriority,
  GoalStatus,
  LifeArea,
  LoadLevel,
  Milestone,
  MilestoneStatus,
  MilestoneType,
  Metric,
  MetricEntry,
  MetricValueType,
  OverviewDashboard,
  ProgressType,
  RecurrenceFrequency,
  RecurrenceRule,
  Review,
  Suggestion,
  TodayDashboard,
  PhysiqueEntry,
  MoodEntry,
  DiaryEntry,
  HistoryDay,
  LifeLesson,
  SavingsEntry,
  WishlistItem,
  WikiPage
} from './types';

type Page = 'today' | 'dashboard' | 'calendar' | 'countdowns' | 'physique' | 'journal' | 'history' | 'lessons' | 'money' | 'goals' | 'areas' | 'templates' | 'metrics' | 'wiki' | 'reviews' | 'backup';
type Theme = 'light' | 'dark';
type CalendarView = 'day' | 'week' | 'month';
type WorkoutExercise = {
  id: string;
  name: string;
  muscle: string;
  sets: number;
  reps: number;
  weightKg: number;
  rir: number;
};
type QuickLogDraft = {
  recordedAt: string;
  durationMinutes: number;
  quantity: number;
  notes: string;
  muscles: string[];
  exercises: WorkoutExercise[];
};

const pages: Array<{ id: Page; label: string; kicker: string; icon: string }> = [
  { id: 'today', label: 'Today', kicker: 'Operate', icon: '//' },
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

const primaryPageIds: Page[] = ['today', 'calendar', 'dashboard', 'goals', 'journal'];

const loadLevels: LoadLevel[] = ['Low', 'Medium', 'High'];
const activityStatuses: ActivityStatus[] = ['Planned', 'Completed', 'Skipped', 'Moved', 'Cancelled'];
const goalStatuses: GoalStatus[] = ['Active', 'Paused', 'Completed', 'Archived'];
const goalPriorities: GoalPriority[] = ['Primary', 'Secondary', 'Maintenance'];
const progressTypes: ProgressType[] = ['Manual', 'MilestoneBased', 'CountBased', 'MetricBased', 'Decay', 'Streak', 'Maintenance'];
const milestoneTypes: MilestoneType[] = ['Count', 'Repetition', 'Binary', 'Metric', 'Checklist'];
const milestoneStatuses: MilestoneStatus[] = ['Active', 'Completed', 'Paused', 'Archived'];
const metricTypes: MetricValueType[] = ['Number', 'Percentage', 'Duration', 'Currency', 'Rating', 'Boolean'];
const recurrenceFrequencies: RecurrenceFrequency[] = ['Daily', 'Weekly', 'Monthly'];
const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const workoutMuscles = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Core'];
const workoutMarker = '[axis-workout-v1]';
const defaultPageSize = 12;
const dashboardRanges = [
  { value: 1, label: '1D' },
  { value: 7, label: 'Week' },
  { value: 30, label: 'Month' },
  { value: 60, label: '2M' },
  { value: 180, label: '6M' }
];

export default function App() {
  const [page, setPage] = useState<Page>('today');
  const [areas, setAreas] = useState<LifeArea[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [goalProgress, setGoalProgress] = useState<GoalProgress[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [templates, setTemplates] = useState<ActivityTemplate[]>([]);
  const [recurrenceRules, setRecurrenceRules] = useState<RecurrenceRule[]>([]);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [countdowns, setCountdowns] = useState<Countdown[]>([]);
  const [physiqueEntries, setPhysiqueEntries] = useState<PhysiqueEntry[]>([]);
  const [moodEntries, setMoodEntries] = useState<MoodEntry[]>([]);
  const [diaryEntries, setDiaryEntries] = useState<DiaryEntry[]>([]);
  const [lifeLessons, setLifeLessons] = useState<LifeLesson[]>([]);
  const [savingsEntries, setSavingsEntries] = useState<SavingsEntry[]>([]);
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);
  const [wikiPages, setWikiPages] = useState<WikiPage[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [today, setToday] = useState<TodayDashboard | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [overview, setOverview] = useState<OverviewDashboard | null>(null);
  const [balance, setBalance] = useState<BalanceRow[]>([]);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [page]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => localStorage.getItem('axis-theme') === 'dark' ? 'dark' : 'light');

  async function load() {
    setIsLoading(true);
    try {
      setError('');
      const [lifeAreas, activeGoals, progressRows, recentActivities, templateRows, recurrenceRows, metricRows, countdownRows, physiqueRows, moodRows, diaryRows, lessonRows, savingsRows, wishlistRows, wikiRows, reviewRows, todayData, suggestionRows, overviewData, balanceRows] = await Promise.all([
        api.get<LifeArea[]>('/api/life-areas'),
        api.get<Goal[]>('/api/goals'),
        api.get<GoalProgress[]>('/api/dashboard/progress'),
        api.get<Activity[]>('/api/activities'),
        api.get<ActivityTemplate[]>('/api/activity-templates'),
        api.get<RecurrenceRule[]>('/api/recurrence-rules'),
        api.get<Metric[]>('/api/metrics'),
        api.get<Countdown[]>('/api/countdowns'),
        api.get<PhysiqueEntry[]>('/api/physique'),
        api.get<MoodEntry[]>('/api/mood'),
        api.get<DiaryEntry[]>('/api/diary'),
        api.get<LifeLesson[]>('/api/life-lessons'),
        api.get<SavingsEntry[]>('/api/money/savings'),
        api.get<WishlistItem[]>('/api/money/wishlist'),
        api.get<WikiPage[]>('/api/wiki-pages'),
        api.get<Review[]>('/api/reviews'),
        api.get<TodayDashboard>('/api/dashboard/today'),
        api.get<Suggestion[]>('/api/dashboard/suggestions'),
        api.get<OverviewDashboard>('/api/dashboard'),
        api.get<BalanceRow[]>('/api/dashboard/balance')
      ]);

      setAreas(lifeAreas);
      setGoals(activeGoals);
      setGoalProgress(progressRows);
      setActivities(recentActivities);
      setTemplates(templateRows);
      setRecurrenceRules(recurrenceRows);
      setMetrics(metricRows);
      setCountdowns(countdownRows);
      setPhysiqueEntries(physiqueRows);
      setMoodEntries(moodRows);
      setDiaryEntries(diaryRows);
      setLifeLessons(lessonRows);
      setSavingsEntries(savingsRows);
      setWishlistItems(wishlistRows);
      setWikiPages(wikiRows);
      setReviews(reviewRows);
      setToday(todayData);
      setSuggestions(suggestionRows);
      setOverview(overviewData);
      setBalance(balanceRows);
    } catch (requestError) {
      setError(readError(requestError, 'Could not load Axis data.'));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('axis-theme', theme);
  }, [theme]);

  async function runAction(action: () => Promise<unknown>, message: string) {
    setIsBusy(true);
    try {
      setError('');
      await action();
      setNotice(message);
      await load();
    } catch (requestError) {
      setError(readError(requestError, 'Action failed.'));
    } finally {
      setIsBusy(false);
    }
  }

  async function quickLogTemplate(template: ActivityTemplate, draft?: QuickLogDraft) {
    const end = draft?.recordedAt ? new Date(draft.recordedAt) : new Date();
    const durationMinutes = Math.max(1, draft?.durationMinutes ?? template.defaultDurationMinutes);
    const quantity = isBinaryCheckIn(template.title) ? 1 : Math.max(1, draft?.quantity ?? 1);
    const start = new Date(end.getTime() - durationMinutes * 60000);
    const humanNotes = [
      'Quick logged from Today.',
      !isBinaryCheckIn(template.title) ? `Quantity: ${quantity}` : '',
      draft?.muscles.length ? `Muscles: ${draft.muscles.join(', ')}` : '',
      draft?.notes ?? ''
    ].filter(Boolean).join(' · ');
    const notes = template.title === 'Hypertrophy workout'
      ? serializeWorkoutNotes(humanNotes, draft?.exercises ?? [])
      : humanNotes;
    const existing = activities.find((activity) =>
      activity.templateId === template.id
      && activity.status === 'Planned'
      && sameDay(activity.plannedStartAt ?? activity.actualStartAt, end)
    );
    const body = {
      lifeAreaId: template.lifeAreaId,
      goalId: findGoalIdForTemplate(template.title, goals),
      milestoneId: null,
      templateId: template.id,
      title: template.title,
      description: template.description,
      plannedStartAt: existing?.plannedStartAt ?? start.toISOString(),
      plannedEndAt: existing?.plannedEndAt ?? end.toISOString(),
      actualStartAt: start.toISOString(),
      actualEndAt: end.toISOString(),
      durationMinutes,
      status: 'Completed',
      energyCost: template.energyCost,
      mentalLoad: template.mentalLoad,
      physicalLoad: template.physicalLoad,
      points: template.defaultPoints * quantity,
      notes
    };

    if (existing) {
      await api.put(`/api/activities/${existing.id}`, body);
    } else {
      await api.post('/api/activities', body);
    }
  }

  async function deleteQuickLog(activity: Activity) {
    await api.delete(`/api/activities/${activity.id}`);
  }

  const activePage = pages.find((item) => item.id === page) ?? pages[0];

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="brand-block">
          <span className="brand-mark">AX</span>
          <div>
            <p className="eyebrow">Neon local-first</p>
            <h1>Axis</h1>
          </div>
        </div>

        <nav className="main-nav" aria-label="Axis sections">
          {pages.filter((item) => primaryPageIds.includes(item.id)).map((item) => (
            <VaporNavButton key={item.id} item={item} isActive={page === item.id} onSelect={() => setPage(item.id)} />
          ))}
        </nav>

        <details className="tool-drawer" open={!primaryPageIds.includes(page)}>
          <summary>More tools</summary>
          <div className="tool-nav">
            {pages.filter((item) => !primaryPageIds.includes(item.id)).map((item) => (
              <VaporNavButton key={item.id} item={item} isActive={page === item.id} onSelect={() => setPage(item.id)} />
            ))}
          </div>
        </details>

        <button className="ghost-button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
        </button>
      </aside>

      <main className="app-main">
        <header className="topbar">
          <div>
            <p className="eyebrow">{activePage.kicker}</p>
            <h2>{activePage.label}</h2>
          </div>
          <div className="topbar-summary">
            <SummaryPill label="Goals" value={overview?.activeGoals ?? 0} />
            <SummaryPill label="Done week" value={overview?.completedThisWeek ?? 0} />
            <SummaryPill label="Areas" value={areas.length} />
          </div>
        </header>

        {(notice || error) && <div className={error ? 'notice error' : 'notice'}>{error || notice}</div>}
        {isLoading && <div className="loading-strip"><span /> Syncing local data</div>}

        {page === 'today' && (
          <TodayPage
            today={today}
            suggestions={suggestions}
            overview={overview}
            balance={balance}
            goals={goals}
            areas={areas}
            activities={activities}
            templates={templates}
            busy={isBusy}
            onQuickLog={(template, draft) => runAction(() => quickLogTemplate(template, draft), `${template.title} logged.`)}
            onDeleteLog={(activity) => runAction(() => deleteQuickLog(activity), `${activity.title} log deleted.`)}
            onComplete={(id) => runAction(() => api.post(`/api/activities/${id}/complete`), 'Activity completed.')}
            onSkip={(id) => runAction(() => api.post(`/api/activities/${id}/skip`), 'Activity skipped.')}
            onSaveActivity={(activity, id) => runAction(
              () => id ? api.put(`/api/activities/${id}`, activity) : api.post('/api/activities', activity),
              id ? 'Main focus updated.' : 'Main focus planned.'
            )}
            onDeleteActivity={(id) => runAction(() => api.delete(`/api/activities/${id}`), 'Activity deleted.')}
          />
        )}
        {page === 'dashboard' && (
          <DashboardPage
            activities={activities}
            templates={templates}
            rules={recurrenceRules}
            goals={goals}
            metrics={metrics}
            busy={isBusy}
            onComplete={(id) => runAction(() => api.post(`/api/activities/${id}/complete`), 'Activity completed.')}
            onSkip={(id) => runAction(() => api.post(`/api/activities/${id}/skip`), 'Activity skipped.')}
          />
        )}
        {page === 'calendar' && (
          <CalendarPage
            areas={areas}
            goals={goals}
            activities={activities.filter((activity) => !activity.templateId)}
            busy={isBusy}
            onSave={(activity, id) => runAction(
              () => id ? api.put(`/api/activities/${id}`, activity) : api.post('/api/activities', activity),
              id ? 'Activity updated.' : 'Activity planned.'
            )}
            onComplete={(id) => runAction(() => api.post(`/api/activities/${id}/complete`), 'Activity completed.')}
            onSkip={(id) => runAction(() => api.post(`/api/activities/${id}/skip`), 'Activity skipped.')}
            onDelete={(id) => runAction(() => api.delete(`/api/activities/${id}`), 'Activity deleted.')}
          />
        )}
        {page === 'countdowns' && (
          <CountdownsPage
            countdowns={countdowns}
            busy={isBusy}
            onSave={(countdown, id) => runAction(
              () => id ? api.put(`/api/countdowns/${id}`, countdown) : api.post('/api/countdowns', countdown),
              id ? 'Countdown updated.' : 'Countdown created.'
            )}
            onDelete={(id) => runAction(() => api.delete(`/api/countdowns/${id}`), 'Countdown deleted.')}
          />
        )}
        {page === 'physique' && (
          <PhysiquePage
            entries={physiqueEntries}
            busy={isBusy}
            onSave={(entry, id) => runAction(
              () => id ? api.put(`/api/physique/${id}`, entry) : api.post('/api/physique', entry),
              id ? 'Physique entry updated.' : 'Physique entry logged.'
            )}
            onDelete={(id) => runAction(() => api.delete(`/api/physique/${id}`), 'Physique entry deleted.')}
          />
        )}
        {page === 'journal' && (
          <JournalPage
            moods={moodEntries}
            entries={diaryEntries}
            busy={isBusy}
            onSave={(mood, diary, moodId, diaryId) => runAction(async () => {
              const writes: Promise<unknown>[] = [moodId ? api.put(`/api/mood/${moodId}`, mood) : api.post('/api/mood', mood)];
              if (diary) writes.push(diaryId ? api.put(`/api/diary/${diaryId}`, diary) : api.post('/api/diary', diary));
              await Promise.all(writes);
            }, moodId || diaryId ? 'Journal entry updated.' : 'Journal check-in saved.')}
            onDeleteMood={(id) => runAction(() => api.delete(`/api/mood/${id}`), 'Mood entry deleted.')}
            onDeleteDiary={(id) => runAction(() => api.delete(`/api/diary/${id}`), 'Diary entry deleted.')}
            onDeleteDiaryRange={(ids) => runAction(() => Promise.all(ids.map((id) => api.delete(`/api/diary/${id}`))), `${ids.length} exported journal entries removed.`)}
          />
        )}
        {page === 'history' && <HistoryPage />}
        {page === 'lessons' && <LifeLessonsPage lessons={lifeLessons} busy={isBusy} onSave={(body, id) => runAction(() => id ? api.put(`/api/life-lessons/${id}`, body) : api.post('/api/life-lessons', body), id ? 'Life lesson updated.' : 'Life lesson saved.')} onDelete={(id) => runAction(() => api.delete(`/api/life-lessons/${id}`), 'Life lesson deleted.')} />}
        {page === 'money' && <MoneyPage savings={savingsEntries} wishlist={wishlistItems} busy={isBusy} onSaveSavings={(body, id) => runAction(() => id ? api.put(`/api/money/savings/${id}`, body) : api.post('/api/money/savings', body), id ? 'Savings entry updated.' : 'Savings balance recorded.')} onDeleteSavings={(id) => runAction(() => api.delete(`/api/money/savings/${id}`), 'Savings entry deleted.')} onSaveWish={(body, id) => runAction(() => id ? api.put(`/api/money/wishlist/${id}`, body) : api.post('/api/money/wishlist', body), id ? 'Wishlist item updated.' : 'Wishlist item added.')} onDeleteWish={(id) => runAction(() => api.delete(`/api/money/wishlist/${id}`), 'Wishlist item deleted.')} />}
        {page === 'goals' && (
          <GoalsPage
            areas={areas}
            goals={goals}
            progress={goalProgress}
            activities={activities}
            metrics={metrics}
            busy={isBusy}
            onSave={(goal, id) => runAction(
              () => id ? api.put(`/api/goals/${id}`, goal) : api.post('/api/goals', goal),
              id ? 'Goal updated.' : 'Goal created.'
            )}
            onMilestoneSave={(goalId, milestone, id) => runAction(
              () => id ? api.put(`/api/milestones/${id}`, milestone) : api.post(`/api/goals/${goalId}/milestones`, milestone),
              id ? 'Milestone updated.' : 'Milestone created.'
            )}
            onMilestoneDelete={(id) => runAction(() => api.delete(`/api/milestones/${id}`), 'Milestone deleted.')}
            onDelete={(id) => runAction(() => api.delete(`/api/goals/${id}`), 'Goal deleted.')}
          />
        )}
        {page === 'areas' && (
          <AreasPage
            areas={areas}
            busy={isBusy}
            onSave={(area, id) => runAction(
              () => id ? api.put(`/api/life-areas/${id}`, area) : api.post('/api/life-areas', area),
              id ? 'Life area updated.' : 'Life area created.'
            )}
            onDelete={(id) => runAction(() => api.delete(`/api/life-areas/${id}`), 'Life area deleted.')}
          />
        )}
        {page === 'templates' && (
          <TemplatesPage
            areas={areas}
            templates={templates}
            rules={recurrenceRules}
            busy={isBusy}
            onSave={(template, id) => runAction(
              () => id ? api.put(`/api/activity-templates/${id}`, template) : api.post('/api/activity-templates', template),
              id ? 'Template updated.' : 'Template created.'
            )}
            onDelete={(id) => runAction(() => api.delete(`/api/activity-templates/${id}`), 'Template deleted.')}
            onRuleSave={(rule, id) => runAction(
              () => id ? api.put(`/api/recurrence-rules/${id}`, rule) : api.post('/api/recurrence-rules', rule),
              id ? 'Recurrence updated.' : 'Recurrence created.'
            )}
            onRuleDelete={(id) => runAction(() => api.delete(`/api/recurrence-rules/${id}`), 'Recurrence deleted.')}
            onGenerate={(id) => runAction(() => api.post(`/api/recurrence-rules/${id}/generate`, {}), 'Recurring activities generated.')}
          />
        )}
        {page === 'metrics' && (
          <MetricsPage
            areas={areas}
            goals={goals}
            metrics={metrics}
            busy={isBusy}
            onSave={(metric, id) => runAction(
              () => id ? api.put(`/api/metrics/${id}`, metric) : api.post('/api/metrics', metric),
              id ? 'Metric updated.' : 'Metric created.'
            )}
            onEntry={(id, body) => runAction(() => api.post(`/api/metrics/${id}/entries`, body), 'Metric entry logged.')}
            onEntryDelete={(metricId, entryId) => runAction(() => api.delete(`/api/metrics/${metricId}/entries/${entryId}`), 'Metric entry deleted.')}
            onDelete={(id) => runAction(() => api.delete(`/api/metrics/${id}`), 'Metric deleted.')}
          />
        )}
        {page === 'wiki' && <WikiPageView pages={wikiPages} />}
        {page === 'reviews' && (
          <ReviewsPage
            reviews={reviews}
            activities={activities}
            goals={goals}
            busy={isBusy}
            onGenerate={() => runAction(() => api.post('/api/reviews/weekly/generate'), 'Weekly review generated.')}
            onGenerateMonthly={() => runAction(() => api.post('/api/reviews/monthly/generate'), 'Monthly review generated.')}
            onSave={(id, review) => runAction(() => api.put(`/api/reviews/${id}`, review), 'Review saved.')}
            onDelete={(id) => runAction(() => api.delete(`/api/reviews/${id}`), 'Review deleted.')}
          />
        )}
        {page === 'backup' && <BackupPage onReload={load} />}
      </main>
    </div>
  );
}

function JournalPage(props: {
  moods: MoodEntry[];
  entries: DiaryEntry[];
  busy: boolean;
  onSave: (mood: unknown, diary: unknown | null, moodId?: string, diaryId?: string) => void;
  onDeleteMood: (id: string) => void;
  onDeleteDiary: (id: string) => void;
  onDeleteDiaryRange: (ids: string[]) => void;
}) {
  const today = localDateKey(new Date().toISOString());
  const [selectedDate, setSelectedDate] = useState(today);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [editingMood, setEditingMood] = useState<MoodEntry | null>(null);
  const [editingDiary, setEditingDiary] = useState<DiaryEntry | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState({ occurredAt: toLocalInput(new Date()), score: 5, energy: 5, stress: 5, context: '', moodNotes: '', title: '', body: '', tags: '' });
  const visibleMoods = props.moods.filter((entry) => localDateKey(entry.recordedAt) === selectedDate);
  const visibleEntries = props.entries.filter((entry) => localDateKey(entry.occurredAt) === selectedDate);
  const timeline = [
    ...visibleMoods.map((entry) => ({ at: entry.recordedAt, kind: 'mood' as const, entry })),
    ...visibleEntries.map((entry) => ({ at: entry.occurredAt, kind: 'diary' as const, entry }))
  ].sort((first, second) => new Date(second.at).getTime() - new Date(first.at).getTime());
  const recentMood = props.moods.slice(0, 28);
  const moodAverage = recentMood.length ? roundNumber(recentMood.reduce((sum, entry) => sum + entry.score, 0) / recentMood.length) : '-';
  const energyAverage = recentMood.length ? roundNumber(recentMood.reduce((sum, entry) => sum + entry.energy, 0) / recentMood.length) : '-';
  const stressAverage = recentMood.length ? roundNumber(recentMood.reduce((sum, entry) => sum + entry.stress, 0) / recentMood.length) : '-';

  function closestPair(at: string) {
    const time = new Date(at).getTime();
    const mood = props.moods.map((entry) => ({ entry, distance: Math.abs(new Date(entry.recordedAt).getTime() - time) })).sort((a, b) => a.distance - b.distance)[0];
    const diary = props.entries.map((entry) => ({ entry, distance: Math.abs(new Date(entry.occurredAt).getTime() - time) })).sort((a, b) => a.distance - b.distance)[0];
    return { mood: mood?.distance <= 2 * 60 * 60 * 1000 ? mood.entry : null, diary: diary?.distance <= 2 * 60 * 60 * 1000 ? diary.entry : null };
  }

  function editAt(at: string) {
    const pair = closestPair(at);
    setEditingMood(pair.mood);
    setEditingDiary(pair.diary);
    setEditorOpen(true);
    setDraft({
      occurredAt: toLocalInput(new Date(at)),
      score: pair.mood?.score ?? 5,
      energy: pair.mood?.energy ?? 5,
      stress: pair.mood?.stress ?? 5,
      context: pair.mood?.context ?? '',
      moodNotes: pair.mood?.notes ?? '',
      title: pair.diary?.title ?? '',
      body: pair.diary?.body ?? '',
      tags: pair.diary?.tags ?? ''
    });
  }

  function reset() {
    setEditingMood(null);
    setEditingDiary(null);
    setEditorOpen(false);
    setDraft({ occurredAt: toLocalInput(new Date()), score: 5, energy: 5, stress: 5, context: '', moodNotes: '', title: '', body: '', tags: '' });
  }

  const exportDiary = async (mode: 'day' | 'range' | 'all', removeAfter = false) => {
    const query = mode === 'day' ? `?from=${selectedDate}&to=${selectedDate}` : mode === 'range' ? `?from=${from}&to=${to}` : '';
    const file = await api.download(`/api/diary/export${query}`, 'axis-diary.zip');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(file.blob);
    link.download = file.fileName;
    link.click();
    URL.revokeObjectURL(link.href);
    if (removeAfter) {
      const rangeStart = mode === 'day' ? selectedDate : from;
      const rangeEnd = mode === 'day' ? selectedDate : to;
      const ids = props.entries.filter((entry) => {
        const key = localDateKey(entry.occurredAt);
        return key >= rangeStart && key <= rangeEnd;
      }).map((entry) => entry.id);
      if (ids.length > 0) props.onDeleteDiaryRange(ids);
    }
  };

  return <section className="workspace-grid drawer-workspace journal-workspace journal-page">
    <div className="page-grid">
      <section className="surface journal-summary">
        <div className="collection-header flush-header"><SectionTitle kicker="Last 28 check-ins" title="Mind trend" /><div className="journal-summary-metrics"><SummaryPill label="Mood" value={`${moodAverage}/10`} /><SummaryPill label="Energy" value={`${energyAverage}/10`} /><SummaryPill label="Stress" value={`${stressAverage}/10`} /></div></div>
        <JournalMoodChart entries={recentMood} />
      </section>
      <section className="surface">
        <div className="collection-header flush-header"><SectionTitle kicker="Mood + diary" title="Daily record" /><div className="journal-header-actions"><label className="field compact-field"><span>Read day</span><input type="date" max={today} value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} /></label><button onClick={() => {
          reset();
          setEditorOpen(true);
        }}>New check-in</button></div></div>
        <div className="history-timeline journal-timeline">{timeline.slice(0, 12).map((item) => item.kind === 'mood'
          ? <article className="timeline-entry kind-mood" key={`mood-${item.entry.id}`}><time>{new Date(item.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time><div><h4>Mood {item.entry.score}/10</h4><p>Energy {item.entry.energy}/10 · Stress {item.entry.stress}/10 · {item.entry.context || 'No context'}</p>{item.entry.notes && <p>{item.entry.notes}</p>}</div><div className="row-actions"><button className="secondary-button" onClick={() => editAt(item.at)}>Edit check-in</button><button className="danger-button" onClick={() => props.onDeleteMood(item.entry.id)}>Delete</button></div></article>
          : <article className="timeline-entry kind-diary" key={`diary-${item.entry.id}`}><time>{new Date(item.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time><div><h4>{item.entry.title}</h4><p>{item.entry.body}</p>{item.entry.tags && <small>{item.entry.tags}</small>}</div><div className="row-actions"><button className="secondary-button" onClick={() => editAt(item.at)}>Edit check-in</button><button className="danger-button" onClick={() => props.onDeleteDiary(item.entry.id)}>Delete</button></div></article>
        )}</div>
        {timeline.length === 0 && <EmptyState text="Nothing was recorded on this day." />}
        {timeline.length > 12 && <p className="helper-copy">Showing the 12 newest items for this day.</p>}
        <div className="export-strip"><button className="secondary-button" onClick={() => void exportDiary('day')}>Export day</button><label className="field compact-field"><span>From</span><input type="date" value={from} max={today} onChange={(event) => setFrom(event.target.value)} /></label><label className="field compact-field"><span>To</span><input type="date" value={to} min={from} max={today} onChange={(event) => setTo(event.target.value)} /></label><button className="secondary-button" onClick={() => void exportDiary('range')}>Export range</button><button className="danger-button" onClick={() => confirmDelete('Export this range and permanently remove its journal entries from Axis?') && void exportDiary('range', true)}>Export + remove range</button><button className="ghost-button" onClick={() => void exportDiary('all')}>Export all</button></div>
      </section>
    </div>
    <EditorDrawer open={editorOpen} label={editingMood || editingDiary ? 'Edit check-in' : 'New check-in'} onClose={reset}><EditorShell title={editingMood || editingDiary ? 'Edit check-in' : 'Write and check in'} onCancel={reset}><form className="editor-form diary-form" onSubmit={(event) => {
      event.preventDefault();
      const occurredAt = new Date(draft.occurredAt).toISOString();
      props.onSave(
        { recordedAt: occurredAt, score: draft.score, energy: draft.energy, stress: draft.stress, context: draft.context, notes: draft.moodNotes },
        draft.title.trim() || draft.body.trim() ? { occurredAt, title: draft.title.trim() || 'Journal entry', body: draft.body, tags: draft.tags } : null,
        editingMood?.id,
        editingDiary?.id
      );
      reset();
    }}>
      <label className="field"><span>When</span><input type="datetime-local" value={draft.occurredAt} max={toLocalInput(new Date())} onChange={(event) => setDraft({ ...draft, occurredAt: event.target.value })} /></label>
      <div className="journal-sliders">{(['score', 'energy', 'stress'] as const).map((field) => <label className="field" key={field}><span>{field[0].toUpperCase() + field.slice(1)}: {draft[field]}/10</span><input type="range" min="1" max="10" value={draft[field]} onChange={(event) => setDraft({ ...draft, [field]: Number(event.target.value) })} /></label>)}</div>
      <TextField label="What is happening?" value={draft.context} onChange={(context) => setDraft({ ...draft, context })} />
      <TextArea label="Mood note" value={draft.moodNotes} onChange={(moodNotes) => setDraft({ ...draft, moodNotes })} />
      <TextField label="Diary title (optional)" value={draft.title} onChange={(title) => setDraft({ ...draft, title })} />
      <label className="field full diary-paper"><span>Diary</span><textarea value={draft.body} onChange={(event) => setDraft({ ...draft, body: event.target.value })} placeholder="Write freely..." /></label>
      <TextField label="Tags" value={draft.tags} onChange={(tags) => setDraft({ ...draft, tags })} />
      <small className="helper-copy">You can record an earlier moment. Future timestamps are blocked.</small>
      <button disabled={props.busy}>Save check-in</button>
    </form></EditorShell></EditorDrawer>
  </section>;
}

function JournalMoodChart({ entries }: { entries: MoodEntry[] }) {
  const [mode, setMode] = useState<'lines' | 'bands'>('lines');
  const [selected, setSelected] = useState<MoodEntry | null>(null);
  const sorted = [...entries].sort((first, second) => new Date(first.recordedAt).getTime() - new Date(second.recordedAt).getTime());
  const points = (field: 'score' | 'energy' | 'stress') => sorted.map((entry, index) => `${sorted.length === 1 ? 50 : index / (sorted.length - 1) * 100},${92 - entry[field] / 10 * 78}`).join(' ');
  const latest = selected ?? sorted.at(-1);
  const average = (field: 'score' | 'energy' | 'stress') => sorted.length ? roundNumber(sorted.reduce((sum, item) => sum + item[field], 0) / sorted.length) : 0;
  return <div className="journal-chart professional-chart">
    <div className="chart-control-row"><div className="chart-legend"><span className="mood">Mood</span><span className="energy">Energy</span><span className="stress">Stress</span></div><div className="segmented-control compact"><button className={mode === 'lines' ? 'active' : ''} onClick={() => setMode('lines')}>Lines</button><button className={mode === 'bands' ? 'active' : ''} onClick={() => setMode('bands')}>Bands</button></div></div>
    <div className="chart-insight-strip"><span><small>Mood avg</small><strong>{average('score')}/10</strong></span><span><small>Energy avg</small><strong>{average('energy')}/10</strong></span><span><small>Stress avg</small><strong>{average('stress')}/10</strong></span><span><small>Selected</small><strong>{latest ? `${latest.score}/${latest.energy}/${latest.stress}` : '-'}</strong></span></div>
    <div className="journal-plot-shell">
      <div className="journal-y-axis"><span>10</span><span>5</span><span>1</span></div>
      <div className="journal-plot"><span className="plot-unit">score / 10</span><svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Mood, energy, and stress trend over recent check-ins"><line x1="0" x2="100" y1="14" y2="14" className="chart-grid" /><line x1="0" x2="100" y1="53" y2="53" className="chart-grid" /><line x1="0" x2="100" y1="92" y2="92" className="chart-axis" />{mode === 'lines' && sorted.length > 0 && <><polyline className="mood" points={points('score')} /><polyline className="energy" points={points('energy')} /><polyline className="stress" points={points('stress')} /></>}{mode === 'bands' && sorted.map((entry, index) => { const x = sorted.length === 1 ? 50 : index / (sorted.length - 1) * 100; const width = Math.min(2.2, 62 / Math.max(1, sorted.length)); return <g key={entry.id} className="journal-bands"><rect x={x - width * 1.6} y={92 - entry.score / 10 * 78} width={width} height={entry.score / 10 * 78} className="mood" /><rect x={x - width / 2} y={92 - entry.energy / 10 * 78} width={width} height={entry.energy / 10 * 78} className="energy" /><rect x={x + width * .6} y={92 - entry.stress / 10 * 78} width={width} height={entry.stress / 10 * 78} className="stress" /></g>; })}{sorted.map((entry, index) => <g className="journal-hit" key={`hit-${entry.id}`} onClick={() => setSelected(entry)}><rect x={Math.max(0, (sorted.length === 1 ? 50 : index / (sorted.length - 1) * 100) - 2)} y="0" width="4" height="96" /><circle cx={sorted.length === 1 ? 50 : index / (sorted.length - 1) * 100} cy={92 - entry.score / 10 * 78} r="1.6"><title>{formatDateTime(entry.recordedAt)}: mood {entry.score}, energy {entry.energy}, stress {entry.stress}</title></circle></g>)}</svg></div>
    </div>
    <div className="chart-range"><span>{sorted[0] ? formatShortDate(sorted[0].recordedAt) : 'No data'}</span><span>{latest ? `${formatShortDate(latest.recordedAt)} · ${latest.context || 'No context'}` : ''}</span><span>{sorted.at(-1) ? formatShortDate(sorted.at(-1)!.recordedAt) : ''}</span></div>
  </div>;
}

function HistoryPage() {
  const today = localDateKey(new Date().toISOString());
  const [date, setDate] = useState(today);
  const [day, setDay] = useState<HistoryDay | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [kind, setKind] = useState('All');
  useEffect(() => { setExpanded(false); void api.get<HistoryDay>(`/api/history?date=${date}`).then(setDay); }, [date]);
  const kinds = ['All', ...Array.from(new Set(day?.timeline.map((item) => item.kind) ?? []))];
  const filtered = day?.timeline.filter((item) => kind === 'All' || item.kind === kind) ?? [];
  const visible = expanded ? filtered : filtered.slice(0, 12);
  return <section className="page-grid history-page"><section className="surface history-console"><div className="collection-header"><SectionTitle kicker="Life history" title="Reconstruct a day" /><label className="field compact-field"><span>Day</span><input type="date" max={today} value={date} onChange={(event) => setDate(event.target.value)} /></label></div><div className="history-pulse"><strong>{day?.timeline.length ?? 0}</strong><span>recorded signals</span>{kinds.slice(1).map((item) => <i key={item}>{item}: {day?.timeline.filter((entry) => entry.kind === item).length}</i>)}</div><div className="history-kind-filter">{kinds.map((item) => <button key={item} className={kind === item ? 'active' : ''} onClick={() => { setKind(item); setExpanded(false); }}>{item}</button>)}</div><div className="history-timeline">{visible.map((item, index) => <article className={`timeline-entry kind-${item.kind.toLowerCase()}`} key={`${item.at}-${index}`}><time>{new Date(item.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time><div><small>{item.kind}</small><h4>{item.title}</h4><p>{item.detail}</p></div></article>)}</div>{filtered.length > 12 && <button className="secondary-button" onClick={() => setExpanded((current) => !current)}>{expanded ? 'Show less' : `Show all ${filtered.length}`}</button>}{day && filtered.length === 0 && <EmptyState text="No recorded signals for this view." />}</section></section>;
}

function TodayPage(props: {
  today: TodayDashboard | null;
  suggestions: Suggestion[];
  overview: OverviewDashboard | null;
  balance: BalanceRow[];
  goals: Goal[];
  areas: LifeArea[];
  activities: Activity[];
  templates: ActivityTemplate[];
  busy: boolean;
  onQuickLog: (template: ActivityTemplate, draft: QuickLogDraft) => void;
  onDeleteLog: (activity: Activity) => void;
  onComplete: (id: string) => void;
  onSkip: (id: string) => void;
  onSaveActivity: (activity: unknown, id?: string) => void;
  onDeleteActivity: (id: string) => void;
}) {
  const [focusDraft, setFocusDraft] = useState<Activity | null>(null);
  const [expandedStatus, setExpandedStatus] = useState<'open' | 'done' | 'skipped' | null>(null);
  const primary = props.today?.primaryGoal ?? props.goals.find((goal) => goal.priority === 'Primary');
  const plannedToday = props.today?.timeline ?? [];
  const quickTemplates = getQuickTemplates(props.templates);
  const recentQuickLogs = props.activities
    .filter((activity) => activity.status === 'Completed' && quickTemplates.some((template) => template.id === activity.templateId))
    .sort((first, second) => new Date(getActivityDate(second) ?? 0).getTime() - new Date(getActivityDate(first) ?? 0).getTime())
    .slice(0, 8);
  const todayDone = plannedToday.filter((activity) => activity.status === 'Completed').length;
  const todayOpen = plannedToday.filter((activity) => activity.status === 'Planned' || activity.status === 'Moved').length;
  const todaySkipped = plannedToday.filter((activity) => activity.status === 'Skipped' || activity.status === 'Cancelled').length;
  const statusActivities = expandedStatus === 'open'
    ? plannedToday.filter((activity) => activity.status === 'Planned' || activity.status === 'Moved')
    : expandedStatus === 'done'
      ? plannedToday.filter((activity) => activity.status === 'Completed')
      : plannedToday.filter((activity) => activity.status === 'Skipped' || activity.status === 'Cancelled');

  function createFocus() {
    const start = new Date();
    start.setSeconds(0, 0);
    setFocusDraft({
      id: '',
      lifeAreaId: primary?.lifeAreaId ?? props.areas[0]?.id ?? '',
      lifeAreaName: primary?.lifeAreaName ?? props.areas[0]?.name ?? '',
      lifeAreaColor: primary?.lifeAreaColor ?? props.areas[0]?.color ?? '#64748b',
      goalId: primary?.id,
      goalTitle: primary?.title,
      title: '',
      description: '',
      plannedStartAt: start.toISOString(),
      plannedEndAt: new Date(start.getTime() + 60 * 60000).toISOString(),
      durationMinutes: 60,
      status: 'Planned',
      energyCost: 'High',
      mentalLoad: 'High',
      physicalLoad: 'Low',
      points: 10,
      notes: ''
    });
  }

  return (
    <section className="page-grid today-page">
      <div className="hero-panel">
        <div>
          <p className="eyebrow">Suggested next move</p>
          <h3>{props.today?.suggestion ?? 'Choose one useful next action.'}</h3>
          <p>{primary ? `Primary goal: ${primary.title}` : 'No primary goal selected yet.'}</p>
        </div>
        <div className="hero-metrics">
          <SummaryPill label="Active goals" value={props.overview?.activeGoals ?? 0} />
          <SummaryPill label="Planned today" value={plannedToday.length} />
        </div>
      </div>

      <section className="work-grid two">
        <FocusPanel title="Main focus" activity={props.today?.mainFocus} busy={props.busy} onComplete={props.onComplete} onSkip={props.onSkip} onEdit={setFocusDraft} onCreate={createFocus} />
        <FocusPanel title="Recovery" activity={props.today?.recoveryTask} busy={props.busy} onComplete={props.onComplete} onSkip={props.onSkip} />
      </section>

      <section className="today-status-strip" aria-label="Today's execution summary">
        <button className={expandedStatus === 'open' ? 'active' : ''} aria-expanded={expandedStatus === 'open'} onClick={() => setExpandedStatus((current) => current === 'open' ? null : 'open')}><span>Open</span><strong>{todayOpen}</strong></button>
        <button className={expandedStatus === 'done' ? 'active' : ''} aria-expanded={expandedStatus === 'done'} onClick={() => setExpandedStatus((current) => current === 'done' ? null : 'done')}><span>Done</span><strong>{todayDone}</strong></button>
        <button className={expandedStatus === 'skipped' ? 'active' : ''} aria-expanded={expandedStatus === 'skipped'} onClick={() => setExpandedStatus((current) => current === 'skipped' ? null : 'skipped')}><span>Skipped</span><strong>{todaySkipped}</strong></button>
        <div><span>Completion</span><strong>{plannedToday.length ? Math.round(todayDone / plannedToday.length * 100) : 0}%</strong></div>
      </section>

      <RecentExecutionPanel days={props.today?.recentDays ?? []} busy={props.busy} onComplete={props.onComplete} onSkip={props.onSkip} />

      {expandedStatus && <section className="surface today-status-detail">
        <div className="collection-header flush-header">
          <SectionTitle kicker="Today" title={expandedStatus === 'open' ? 'Open activities' : expandedStatus === 'done' ? 'Completed activities' : 'Skipped activities'} />
          <button className="ghost-button compact" onClick={() => setExpandedStatus(null)}>Close</button>
        </div>
        <ActivityList activities={statusActivities} busy={props.busy} onComplete={props.onComplete} onSkip={props.onSkip} />
      </section>}

      <TodayTrendsPanel activities={props.activities} />

      <section className="surface">
        <SectionTitle kicker="Last 28 days" title="Life balance" />
        <LifeBalancePanel rows={props.balance} />
      </section>

      <TodayQuickLogPanel
        templates={quickTemplates}
        activities={props.activities}
        recentQuickLogs={recentQuickLogs}
        busy={props.busy}
        onQuickLog={props.onQuickLog}
        onDeleteLog={props.onDeleteLog}
      />

      <HypertrophyCoach activities={props.activities} />

      <section className="surface">
        <SectionTitle kicker="Why this" title="Suggestions" />
        <div className="suggestion-grid">
          {props.suggestions.map((suggestion) => (
            <article className="suggestion-card" key={`${suggestion.kind}-${suggestion.title}`}>
              <span>{suggestion.kind}</span>
              <h4>{suggestion.title}</h4>
              <p>{suggestion.reason}</p>
              {suggestion.activity && (
                <div className="button-row">
                  <button className="secondary-button" disabled={props.busy || suggestion.activity.status === 'Completed'} onClick={() => props.onComplete(suggestion.activity!.id)}>Done</button>
                  <button className="secondary-button" disabled={props.busy || suggestion.activity.status === 'Skipped'} onClick={() => props.onSkip(suggestion.activity!.id)}>Skip</button>
                </div>
              )}
            </article>
          ))}
          {props.suggestions.length === 0 && <EmptyState text="No suggestions yet. Add goals and plan a few activities to wake this up." />}
        </div>
      </section>

      <EditorDrawer open={focusDraft !== null} label={focusDraft?.id ? 'Edit main focus' : 'Create main focus'} onClose={() => setFocusDraft(null)}>
        <ActivityForm
          key={`${focusDraft?.id || 'new-focus'}-${focusDraft?.plannedStartAt ?? ''}`}
          activity={focusDraft}
          areas={props.areas}
          goals={props.goals}
          busy={props.busy}
          onComplete={props.onComplete}
          onSkip={props.onSkip}
          onCancel={() => setFocusDraft(null)}
          onDelete={focusDraft?.id ? () => {
            if (confirmDelete('Delete this main focus?')) props.onDeleteActivity(focusDraft.id);
            setFocusDraft(null);
          } : undefined}
          onSave={(body) => {
            props.onSaveActivity(body, focusDraft?.id || undefined);
            setFocusDraft(null);
          }}
        />
      </EditorDrawer>
    </section>
  );
}

function RecentExecutionPanel(props: {
  days: TodayDashboard['recentDays'];
  busy: boolean;
  onComplete: (id: string) => void;
  onSkip: (id: string) => void;
}) {
  return (
    <section className="surface recent-execution">
      <div className="collection-header flush-header">
        <SectionTitle kicker="Today + 2 days" title="Execution ledger" />
        <div className="execution-key" aria-label="Activity status legend">
          <span className="done"><i />Done</span>
          <span className="open"><i />Open</span>
          <span className="missed"><i />Missed</span>
          <span className="skipped"><i />Skipped</span>
        </div>
      </div>
      <p className="helper-copy">Everything expected today, plus unresolved and completed routines from the previous two days. Older plans stay out of this view.</p>
      <div className="execution-days">
        {props.days.map((day, index) => {
          const done = day.activities.filter((activity) => activity.status === 'Completed').length;
          const skipped = day.activities.filter((activity) => activity.status === 'Skipped' || activity.status === 'Cancelled').length;
          const unresolved = day.activities.length - done - skipped;
          return (
            <article className={`execution-day ${day.isToday ? 'today' : ''}`} key={day.date}>
              <header>
                <div>
                  <span>{day.isToday ? 'Today' : index === 1 ? 'Yesterday' : '2 days ago'}</span>
                  <strong>{formatRecentDay(day.date)}</strong>
                </div>
                <div className="execution-day-score" title={`${done} completed out of ${day.activities.length}`}>
                  <strong>{done}/{day.activities.length}</strong>
                  <small>done</small>
                </div>
              </header>
              <div className="execution-day-counts">
                <span className="done">{done} done</span>
                <span className={day.isToday ? 'open' : 'missed'}>{unresolved} {day.isToday ? 'open' : 'missed'}</span>
                <span className="skipped">{skipped} skipped</span>
              </div>
              <div className="execution-activity-list">
                {day.activities.map((activity) => <RecentExecutionRow key={activity.id} activity={activity} isToday={day.isToday} busy={props.busy} onComplete={props.onComplete} onSkip={props.onSkip} />)}
                {day.activities.length === 0 && <div className="execution-empty"><strong>Nothing expected</strong><span>No routines or manual activities were scheduled.</span></div>}
              </div>
            </article>
          );
        })}
        {props.days.length === 0 && <EmptyState text="The three-day activity ledger is not available yet." />}
      </div>
    </section>
  );
}

function RecentExecutionRow(props: { activity: Activity; isToday: boolean; busy: boolean; onComplete: (id: string) => void; onSkip: (id: string) => void }) {
  const isOpen = props.activity.status === 'Planned' || props.activity.status === 'Moved';
  const isDone = props.activity.status === 'Completed';
  const isSkipped = props.activity.status === 'Skipped' || props.activity.status === 'Cancelled';
  const label = isDone ? 'Done' : isSkipped ? 'Skipped' : props.isToday ? 'Open' : 'Missed';
  const tone = label.toLowerCase();
  return (
    <div className={`execution-activity ${tone}`}>
      <span className="execution-activity-marker" style={{ background: props.activity.lifeAreaColor }} />
      <div className="execution-activity-copy">
        <strong>{props.activity.title}</strong>
        <small>{props.activity.lifeAreaName} · {activityDisplayMeasure(props.activity)}</small>
      </div>
      <span className={`status-badge ${tone}`}>{label}</span>
      <div className="execution-activity-actions">
        {(isOpen || isSkipped) && <button disabled={props.busy || !canCompleteActivity(props.activity)} onClick={() => props.onComplete(props.activity.id)}>{props.isToday && isOpen ? 'Done' : 'Mark done'}</button>}
        {(isOpen || isDone) && <button className="secondary-button" disabled={props.busy} onClick={() => props.onSkip(props.activity.id)}>{isDone ? 'Mark skipped' : 'Skip'}</button>}
      </div>
    </div>
  );
}

function formatRecentDay(value: string) {
  return new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${value}T12:00:00`));
}

function TodayQuickLogPanel(props: {
  templates: ActivityTemplate[];
  activities: Activity[];
  recentQuickLogs: Activity[];
  busy: boolean;
  onQuickLog: (template: ActivityTemplate, draft: QuickLogDraft) => void;
  onDeleteLog: (activity: Activity) => void;
}) {
  const [templateId, setTemplateId] = useState(props.templates[0]?.id ?? '');
  const template = props.templates.find((item) => item.id === templateId) ?? props.templates[0];
  const [quantity, setQuantity] = useState(1);
  const [duration, setDuration] = useState(template?.defaultDurationMinutes ?? 30);
  const [recordedAt, setRecordedAt] = useState(toLocalInput(new Date()));
  const [notes, setNotes] = useState('');
  const [muscles, setMuscles] = useState<string[]>([]);
  const [exercises, setExercises] = useState<WorkoutExercise[]>([createExercise()]);
  const muscleOptions = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Core'];
  const recentMuscles = props.activities.filter((item) => item.status === 'Completed' && /Muscles:/i.test(item.notes) && new Date(getActivityDate(item) ?? 0) >= addDays(new Date(), -3));
  const recoveryHits = muscles.filter((muscle) => recentMuscles.some((item) => item.notes.includes(muscle)));
  const isSleep = template?.title === 'Sleep log';
  const isCheckIn = template ? isBinaryCheckIn(template.title) : false;
  const sleepScore = quantity >= 8 ? { label: 'Optimal recovery', tone: 'good', copy: 'At or above the 8-hour target.' } : quantity >= 7 ? { label: 'Acceptable, not optimal', tone: 'okay', copy: 'A workable night, but some sleep debt may remain.' } : quantity >= 6 ? { label: 'Recovery compromised', tone: 'warning', copy: 'Training, attention, appetite, and appearance may suffer.' } : { label: 'Severe sleep deficit', tone: 'danger', copy: 'Prioritize recovery and avoid making this a pattern.' };

  useEffect(() => {
    if (!template && props.templates[0]) {
      setTemplateId(props.templates[0].id);
    }
  }, [props.templates, template]);

  function chooseTemplate(id: string) {
    const next = props.templates.find((item) => item.id === id);
    setTemplateId(id);
    setDuration(next?.defaultDurationMinutes ?? 30);
    setQuantity(next?.title === 'Sleep log' ? 8 : 1);
    setMuscles([]);
    setExercises([createExercise()]);
  }

  return (
    <section className="surface today-log-panel">
      <div className="collection-header flush-header">
        <SectionTitle kicker="Operate" title="Log completed work" />
        <label className="field compact-field"><span>When</span><input type="datetime-local" value={recordedAt} max={toLocalInput(new Date())} onChange={(event) => setRecordedAt(event.target.value)} /></label>
      </div>
      <div className="template-picker">{props.templates.map((item) => <button key={item.id} className={template?.id === item.id ? 'active' : ''} onClick={() => chooseTemplate(item.id)}>{item.title}<small>{item.lifeAreaName}</small></button>)}</div>
      {template && (
        <>
          <div className="form-grid three">
            {!isCheckIn && <NumberField label={isSleep ? 'Hours slept' : 'Quantity'} value={quantity} onChange={(value) => setQuantity(Math.max(isSleep ? 0 : 1, value))} />}
            {isDurationActivity(template.title) && <NumberField label="Total minutes" value={duration} onChange={(value) => setDuration(Math.max(1, value))} />}
          </div>
          {isSleep && <div className={`sleep-assessment ${sleepScore.tone}`}><strong>{quantity}h · {sleepScore.label}</strong><span>{sleepScore.copy}</span></div>}
          {template.title === 'Hypertrophy workout' && <><div className="muscle-picker">{muscleOptions.map((muscle) => <button key={muscle} className={muscles.includes(muscle) ? 'active' : ''} onClick={() => setMuscles((current) => current.includes(muscle) ? current.filter((item) => item !== muscle) : [...current, muscle])}>{muscle}</button>)}</div><WorkoutExerciseEditor exercises={exercises} onChange={setExercises} />{recoveryHits.length > 0 && <div className="recovery-warning"><strong>Recovery check</strong><span>{recoveryHits.join(', ')} appeared in a workout during the last 72 hours.</span></div>}</>}
          <TextArea label="Notes" value={notes} onChange={setNotes} />
          <button disabled={props.busy} onClick={() => props.onQuickLog(template, { recordedAt, durationMinutes: isDurationActivity(template.title) ? duration : 1, quantity: isCheckIn ? 1 : quantity, notes, muscles, exercises: template.title === 'Hypertrophy workout' ? exercises.filter((exercise) => exercise.name.trim()) : [] })}>
            {isCheckIn ? 'Confirm check-in' : 'Log completed work'}
          </button>
        </>
      )}
      <div className="recent-log-list compact-recent-log">
        {props.recentQuickLogs.map((activity) => (
          <div className="recent-log-row" key={activity.id}>
            <span><strong>{activity.title}</strong><small>{formatDateTime(getActivityDate(activity) ?? '')}</small></span>
            <button className="danger-button" disabled={props.busy} onClick={() => confirmDelete(`Delete the ${activity.title} log?`) && props.onDeleteLog(activity)}>Delete</button>
          </div>
        ))}
      </div>
    </section>
  );
}

function WorkoutExerciseEditor(props: { exercises: WorkoutExercise[]; onChange: (exercises: WorkoutExercise[]) => void }) {
  function update(id: string, field: keyof WorkoutExercise, value: string | number) {
    props.onChange(props.exercises.map((exercise) => exercise.id === id ? { ...exercise, [field]: value } : exercise));
  }

  return <section className="workout-builder">
    <div className="workout-builder-heading"><div><strong>Exercises</strong><span>Sets, reps, load and reps in reserve</span></div><button type="button" className="secondary-button" onClick={() => props.onChange([...props.exercises, createExercise()])}>Add exercise</button></div>
    <div className="exercise-table">
      {props.exercises.map((exercise, index) => <div className="exercise-row" key={exercise.id}>
        <label className="field exercise-name"><span>Exercise {index + 1}</span><input value={exercise.name} onChange={(event) => update(exercise.id, 'name', event.target.value)} placeholder="e.g. Incline press" /></label>
        <label className="field"><span>Muscle</span><select value={exercise.muscle} onChange={(event) => update(exercise.id, 'muscle', event.target.value)}>{workoutMuscles.map((muscle) => <option key={muscle}>{muscle}</option>)}</select></label>
        <label className="field"><span>Sets</span><input type="number" min="1" max="20" value={exercise.sets} onChange={(event) => update(exercise.id, 'sets', Number(event.target.value))} /></label>
        <label className="field"><span>Reps</span><input type="number" min="1" max="100" value={exercise.reps} onChange={(event) => update(exercise.id, 'reps', Number(event.target.value))} /></label>
        <label className="field"><span>kg</span><input type="number" min="0" step="0.5" value={exercise.weightKg} onChange={(event) => update(exercise.id, 'weightKg', Number(event.target.value))} /></label>
        <label className="field"><span>RIR</span><input type="number" min="0" max="10" value={exercise.rir} onChange={(event) => update(exercise.id, 'rir', Number(event.target.value))} /></label>
        <button type="button" className="danger-button icon-button exercise-remove" aria-label={`Remove exercise ${index + 1}`} onClick={() => props.onChange(props.exercises.length === 1 ? [createExercise()] : props.exercises.filter((item) => item.id !== exercise.id))}>x</button>
      </div>)}
    </div>
  </section>;
}

function TodayTrendsPanel({ activities }: { activities: Activity[] }) {
  const [view, setView] = useState<'charts' | 'cards'>('charts');
  const start = startOfDay(addDays(new Date(), -27));
  const recent = activities.filter((activity) => {
    const at = getActivityDate(activity);
    return at && new Date(at) >= start && new Date(at) <= endOfDay(new Date());
  });
  const weeks = Array.from({ length: 4 }, (_, index) => {
    const weekStart = addDays(start, index * 7);
    const weekEnd = endOfDay(addDays(weekStart, 6));
    const rows = recent.filter((activity) => { const at = getActivityDate(activity); return at && new Date(at) >= weekStart && new Date(at) <= weekEnd; });
    return {
      label: `${weekStart.getDate()}/${weekStart.getMonth() + 1}`,
      done: rows.filter((activity) => activity.status === 'Completed').length,
      skipped: rows.filter((activity) => activity.status === 'Skipped' || activity.status === 'Cancelled').length,
      minutes: rows.filter((activity) => activity.status === 'Completed').reduce((sum, activity) => sum + (isDurationActivity(activity.title) ? activity.durationMinutes : 0), 0)
    };
  });
  const maxCount = Math.max(1, ...weeks.map((week) => week.done + week.skipped));
  const maxMinutes = Math.max(1, ...weeks.map((week) => week.minutes));
  const areaRows = Array.from(recent.filter((activity) => activity.status === 'Completed').reduce((map, activity) => {
    const current = map.get(activity.lifeAreaName) ?? { name: activity.lifeAreaName, color: activity.lifeAreaColor, minutes: 0, count: 0 };
    current.minutes += isDurationActivity(activity.title) ? activity.durationMinutes : 0;
    current.count += 1;
    map.set(activity.lifeAreaName, current);
    return map;
  }, new Map<string, { name: string; color: string; minutes: number; count: number }>()).values()).sort((a, b) => b.minutes - a.minutes || b.count - a.count);
  const maxArea = Math.max(1, ...areaRows.map((row) => row.minutes || row.count));
  const fitnessWeeks = weeks.map((week, index) => {
    const weekStart = addDays(start, index * 7);
    const weekEnd = endOfDay(addDays(weekStart, 6));
    const workouts = recent.filter((activity) => activity.status === 'Completed' && /hypertrophy workout|gym session/i.test(activity.title) && new Date(getActivityDate(activity) ?? 0) >= weekStart && new Date(getActivityDate(activity) ?? 0) <= weekEnd);
    const exercises = workouts.flatMap((activity) => parseWorkoutExercises(activity.notes));
    return {
      label: week.label,
      workouts: workouts.length,
      sets: exercises.reduce((sum, exercise) => sum + exercise.sets, 0),
      volume: exercises.reduce((sum, exercise) => sum + exercise.sets * exercise.reps * exercise.weightKg, 0)
    };
  });
  const maxFitnessSets = Math.max(1, ...fitnessWeeks.map((week) => week.sets));

  return <section className="surface today-trends">
    <div className="collection-header flush-header"><SectionTitle kicker="Last 28 days" title="Execution at a glance" /><div className="segmented-control compact" aria-label="Today trend visualization"><button className={view === 'charts' ? 'active' : ''} onClick={() => setView('charts')}>Charts</button><button className={view === 'cards' ? 'active' : ''} onClick={() => setView('cards')}>Cards</button></div></div>
    {view === 'charts' ? <div className="today-chart-grid">
      <article className="compact-chart"><div className="chart-heading"><strong>Done vs skipped</strong><span>Weekly actions</span></div><div className="stacked-week-chart">{weeks.map((week) => <div key={week.label}><div className="stacked-bars" title={`${week.done} done, ${week.skipped} skipped`}><i className="done" style={{ height: `${week.done / maxCount * 100}%` }} /><i className="skipped" style={{ height: `${week.skipped / maxCount * 100}%` }} /></div><small>{week.label}</small></div>)}</div></article>
      <article className="compact-chart"><div className="chart-heading"><strong>Focused minutes</strong><span>Check-ins excluded</span></div><div className="simple-bar-chart">{weeks.map((week) => <div key={week.label}><span><i style={{ height: `${week.minutes / maxMinutes * 100}%` }} /></span><strong>{week.minutes}</strong><small>{week.label}</small></div>)}</div></article>
      <article className="compact-chart"><div className="chart-heading"><strong>Attention by area</strong><span>Minutes or check-ins</span></div><div className="horizontal-bars">{areaRows.slice(0, 5).map((row) => <div key={row.name}><span>{row.name}</span><div><i style={{ width: `${(row.minutes || row.count) / maxArea * 100}%`, background: row.color }} /></div><strong>{row.minutes ? `${row.minutes}m` : `${row.count}x`}</strong></div>)}{areaRows.length === 0 && <EmptyState text="No completed work in this range." />}</div></article>
      <article className="compact-chart fitness-trend"><div className="chart-heading"><strong>Training load</strong><span>Workouts and hard sets</span></div><div className="simple-bar-chart">{fitnessWeeks.map((week) => <div key={week.label} title={`${week.workouts} workouts, ${week.sets} sets, ${Math.round(week.volume)} kg volume`}><span><i style={{ height: `${week.sets / maxFitnessSets * 100}%` }} /></span><strong>{week.sets}</strong><small>{week.label}</small></div>)}</div><p className="chart-footnote">Latest week: {fitnessWeeks.at(-1)?.workouts ?? 0} workouts · {fitnessWeeks.at(-1)?.sets ?? 0} hard sets · {Math.round(fitnessWeeks.at(-1)?.volume ?? 0)} kg volume</p></article>
    </div> : <div className="today-week-cards">{weeks.map((week, index) => <article key={week.label}><div><span>Week of {week.label}</span><strong>{week.done + week.skipped ? Math.round(week.done / (week.done + week.skipped) * 100) : 0}%</strong></div><dl><div><dt>Done</dt><dd>{week.done}</dd></div><div><dt>Skipped</dt><dd>{week.skipped}</dd></div><div><dt>Focus</dt><dd>{week.minutes}m</dd></div><div><dt>Hard sets</dt><dd>{fitnessWeeks[index].sets}</dd></div><div><dt>Volume</dt><dd>{Math.round(fitnessWeeks[index].volume)}kg</dd></div></dl><i><b style={{ width: `${week.done + week.skipped ? week.done / (week.done + week.skipped) * 100 : 0}%` }} /></i></article>)}</div>}
  </section>;
}

function HypertrophyCoach({ activities }: { activities: Activity[] }) {
  const workouts = activities
    .filter((activity) => activity.status === 'Completed' && /hypertrophy workout|gym session/i.test(activity.title))
    .map((activity) => ({ activity, exercises: parseWorkoutExercises(activity.notes) }))
    .sort((first, second) => new Date(getActivityDate(second.activity) ?? 0).getTime() - new Date(getActivityDate(first.activity) ?? 0).getTime());
  const weekStart = addDays(new Date(), -6);
  const weeklyExercises = workouts.filter((workout) => new Date(getActivityDate(workout.activity) ?? 0) >= weekStart).flatMap((workout) => workout.exercises);
  const muscleRows = workoutMuscles.map((muscle) => ({ muscle, sets: weeklyExercises.filter((exercise) => exercise.muscle === muscle).reduce((sum, exercise) => sum + exercise.sets, 0) })).filter((row) => row.sets > 0);
  const maxSets = Math.max(1, ...muscleRows.map((row) => row.sets));
  const allExercises = workouts.flatMap((workout) => workout.exercises.map((exercise) => ({ exercise, at: getActivityDate(workout.activity) ?? '' })));
  const exerciseNames = Array.from(new Set(allExercises.map((row) => row.exercise.name.trim()).filter(Boolean)));
  const progressionRows = exerciseNames.map((name) => {
    const logs = allExercises.filter((row) => row.exercise.name.trim().toLowerCase() === name.toLowerCase()).sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    const latest = logs[0]?.exercise;
    const previous = logs[1]?.exercise;
    const latestVolume = latest ? latest.sets * latest.reps * latest.weightKg : 0;
    const previousVolume = previous ? previous.sets * previous.reps * previous.weightKg : 0;
    return { name, latest, delta: previousVolume > 0 ? Math.round((latestVolume - previousVolume) / previousVolume * 100) : null };
  }).slice(0, 6);
  const averageRir = weeklyExercises.length ? weeklyExercises.reduce((sum, exercise) => sum + exercise.rir, 0) / weeklyExercises.length : null;
  const suggestions: string[] = [];
  if (workouts.length === 0) suggestions.push('Log your first workout with exercises, sets, reps and load. Axis needs at least two comparable sessions to judge progression.');
  muscleRows.filter((row) => row.sets < 8).forEach((row) => suggestions.push(`${row.muscle}: ${row.sets} hard sets this week. Add 2-4 quality sets next week if recovery and technique are good.`));
  muscleRows.filter((row) => row.sets > 20).forEach((row) => suggestions.push(`${row.muscle}: ${row.sets} sets is a high weekly dose. Reduce volume if performance or recovery is falling.`));
  if (averageRir !== null && averageRir > 3) suggestions.push(`Average RIR is ${roundNumber(averageRir)}. Most working sets may be too easy; add reps or a small amount of load while keeping clean technique.`);
  if (averageRir !== null && averageRir < 1) suggestions.push(`Average RIR is ${roundNumber(averageRir)}. Too many all-out sets can create fatigue; keep most work around 1-3 RIR.`);
  progressionRows.filter((row) => row.delta !== null && row.delta < -10).forEach((row) => suggestions.push(`${row.name}: volume fell ${Math.abs(row.delta!)}% versus the previous log. Check sleep, exercise order and recovery before adding load.`));
  if (workouts.length > 0 && suggestions.length === 0) suggestions.push('Volume and effort are in a productive range. Keep the same plan and progress one variable at a time: one rep, a small load increase, or one extra set.');

  return <section className="surface hypertrophy-coach">
    <div className="collection-header flush-header"><SectionTitle kicker="Training analysis" title="Hypertrophy coach" /><span className="status-badge maintained">{workouts.length} logged workouts</span></div>
    <div className="coach-grid">
      <article className="compact-chart"><div className="chart-heading"><strong>Weekly hard sets</strong><span>Useful range depends on recovery</span></div><div className="horizontal-bars muscle-volume">{muscleRows.map((row) => <div key={row.muscle}><span>{row.muscle}</span><div><i className={row.sets < 8 ? 'low' : row.sets > 20 ? 'high' : ''} style={{ width: `${row.sets / maxSets * 100}%` }} /></div><strong>{row.sets}</strong></div>)}{muscleRows.length === 0 && <EmptyState text="Add exercises to a completed workout to build this chart." />}</div></article>
      <article className="compact-chart"><div className="chart-heading"><strong>Exercise progression</strong><span>Volume versus previous log</span></div><div className="progression-list">{progressionRows.map((row) => <div key={row.name}><span><strong>{row.name}</strong><small>{row.latest ? `${row.latest.sets} x ${row.latest.reps} @ ${row.latest.weightKg} kg · RIR ${row.latest.rir}` : ''}</small></span><em className={(row.delta ?? 0) >= 0 ? 'positive' : 'negative'}>{row.delta === null ? 'baseline' : `${row.delta > 0 ? '+' : ''}${row.delta}%`}</em></div>)}{progressionRows.length === 0 && <EmptyState text="Repeat an exercise to see progression." />}</div></article>
    </div>
    <div className="coach-advice"><strong>Next plan changes</strong>{suggestions.slice(0, 5).map((suggestion) => <p key={suggestion}>{suggestion}</p>)}</div>
    <small className="helper-copy">Training guidance is based on your logs and common hypertrophy principles. Pain, injury, illness and medical constraints need professional judgment.</small>
  </section>;
}

function LifeBalancePanel({ rows }: { rows: BalanceRow[] }) {
  const maxDailyMinutes = Math.max(1, ...rows.flatMap((row) => row.days.map((day) => day.completedMinutes)));

  return (
    <div className="balance-list">
      {rows.map((row) => (
        <article className="balance-card" key={row.lifeAreaId}>
          <div className="balance-card-top">
            <div>
              <strong>{row.name}</strong>
              <span>{row.signal} · {row.hours}h completed</span>
            </div>
            <span className={`status-badge ${row.signal.toLowerCase()}`}>{row.attentionGapPercent > 0 ? '+' : ''}{row.attentionGapPercent}%</span>
          </div>
          <div className="balance-bars">
            <div>
              <span>Actual</span>
              <div className="meter"><i style={{ width: `${Math.min(100, row.percent)}%`, background: row.color }} /></div>
            </div>
            <div>
              <span>Priority</span>
              <div className="meter muted-meter"><i style={{ width: `${Math.min(100, row.targetPercent)}%` }} /></div>
            </div>
          </div>
          <dl className="compact-dl">
            <div><dt>Planned</dt><dd>{minutesToHours(row.plannedMinutes)}h</dd></div>
            <div><dt>Done</dt><dd>{row.completedCount}</dd></div>
            <div><dt>Skipped</dt><dd>{row.skippedCount}</dd></div>
          </dl>
          <div className="balance-heatmap">
            {row.days.map((day) => (
              <span
                key={day.date}
                title={`${day.date}: ${minutesToHours(day.completedMinutes)}h done`}
                style={{
                  background: colorMix(row.color, Math.max(0.12, day.completedMinutes / maxDailyMinutes))
                }}
              />
            ))}
          </div>
        </article>
      ))}
      {rows.length === 0 && <EmptyState text="Complete activities to build your attention map." />}
    </div>
  );
}

function DashboardPage(props: {
  activities: Activity[];
  templates: ActivityTemplate[];
  rules: RecurrenceRule[];
  goals: Goal[];
  metrics: Metric[];
  busy: boolean;
  onComplete: (id: string) => void;
  onSkip: (id: string) => void;
}) {
  const [rangeDays, setRangeDays] = useState(7);
  const now = new Date();
  const rangeStart = startOfDay(addDays(now, -(rangeDays - 1)));
  const days = Array.from({ length: rangeDays }, (_, index) => addDays(rangeStart, index));
  const quickTemplates = getQuickTemplates(props.templates);
  const rangeActivities = props.activities.filter((activity) => {
    const date = getActivityDate(activity);
    return date && new Date(date) >= rangeStart && new Date(date) <= endOfDay(now);
  });
  const tracks = buildDashboardTracks(days, rangeActivities, quickTemplates, props.rules).map((track) => {
    if (!track.template || !['DSA problem rep', 'System design case study'].includes(track.template.title)) return track;
    const goalId = findGoalIdForTemplate(track.template.title, props.goals);
    const goal = props.goals.find((item) => item.id === goalId);
    const milestone = goal?.milestones.filter((item) => item.status === 'Active').sort((a, b) => a.sortOrder - b.sortOrder)[0];
    return milestone ? { ...track, title: milestone.title, cadence: `Current milestone · ${goal?.title}` } : track;
  });
  const completed = rangeActivities.filter((activity) => activity.status === 'Completed').length;
  const missed = tracks.reduce((sum, track) => sum + track.missedCount, 0);
  const studyMinutes = rangeActivities
    .filter((activity) => activity.status === 'Completed' && /DSA|System design/i.test(activity.title))
    .reduce((sum, activity) => sum + activity.durationMinutes, 0);

  return (
    <section className="page-grid signals-page">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Signal dashboard</p>
          <h3>{completed} completed · {missed} gaps</h3>
          <p>Pick a range, scan what was done, and log useful work without turning the calendar into homework.</p>
        </div>
        <div className="hero-metrics">
          <SummaryPill label="Range" value={`${rangeDays}d`} />
          <SummaryPill label="Study" value={`${minutesToHours(studyMinutes)}h`} />
        </div>
      </section>

      <section className="surface">
        <div className="dashboard-toolbar">
          <SectionTitle kicker="Range" title="Momentum" />
          <div className="segmented-control" aria-label="Dashboard range">
            {dashboardRanges.map((range) => (
              <button key={range.value} className={rangeDays === range.value ? 'active' : ''} onClick={() => setRangeDays(range.value)}>
                {range.label}
              </button>
            ))}
          </div>
        </div>
        <div className="current-milestones">
          {tracks.filter((track) => track.cadence.startsWith('Current milestone')).map((track) => (
            <article key={track.title}><span>NOW BUILDING</span><strong>{track.title}</strong><small>{track.cadence.replace('Current milestone · ', '')}</small></article>
          ))}
        </div>
        <div className="track-grid">
          {tracks.map((track) => (
            <article className="track-card" key={track.title}>
              <div className="track-card-top">
                <div>
                  <strong>{track.title}</strong>
                  <span>{track.cadence}</span>
                </div>
                <span className={`status-badge ${track.missedCount > 0 ? 'decaying' : track.completedCount > 0 ? 'maintained' : 'paused'}`}>
                  {track.completedCount}/{track.expectedCount || track.completedCount || 1}
                </span>
              </div>
              <div className="track-heatmap">
                {track.days.map((day) => (
                  <span key={day.key} className={day.status} title={`${day.label}: ${day.status}`} />
                ))}
              </div>
              <dl className="compact-dl">
                <div><dt>Done</dt><dd>{track.completedCount}</dd></div>
                <div><dt>Gaps</dt><dd>{track.missedCount}</dd></div>
                {track.kind === 'duration' && <div><dt>Time</dt><dd>{track.minutes} min</dd></div>}
                {track.kind === 'checkin' && <div><dt>Check-ins</dt><dd>{track.completedCount}</dd></div>}
                {track.kind === 'quantity' && <div><dt>Logged</dt><dd>{roundNumber(track.quantityTotal)} {track.quantityUnit}</dd></div>}
              </dl>
            </article>
          ))}
        </div>
      </section>

      <section className="surface momentum-chart-panel">
        <SectionTitle kicker="Visual trend" title="Momentum over time" />
        <DashboardMomentumChart days={days} tracks={tracks} goals={props.goals} metrics={props.metrics} activities={rangeActivities} />
      </section>

    </section>
  );
}

function DashboardMomentumChart(props: { days: Date[]; tracks: DashboardTrack[]; goals: Goal[]; metrics: Metric[]; activities: Activity[] }) {
  const [mode, setMode] = useState<'overview' | 'goals' | 'metrics'>('overview');
  const [visualization, setVisualization] = useState<'lines' | 'bars' | 'routines'>('routines');
  const [selectedRoutines, setSelectedRoutines] = useState<string[]>(() => props.tracks.slice(0, 4).map((track) => track.title));
  const [selectedDayKey, setSelectedDayKey] = useState(() => dateKey(props.days.at(-1) ?? new Date()));
  const [visibleSeries, setVisibleSeries] = useState({ done: true, missed: true, planned: true });
  const points = props.days.map((day, index) => {
    const key = dateKey(day);
    const statuses = props.tracks.map((track) => track.days.find((item) => item.key === key)?.status);
    return {
      x: props.days.length === 1 ? 50 : index / (props.days.length - 1) * 100,
      day,
      done: statuses.filter((status) => status === 'done').length,
      missed: statuses.filter((status) => status === 'missed' || status === 'skipped').length,
      planned: statuses.filter((status) => status === 'planned').length
    };
  });
  const ceiling = Math.max(1, ...points.flatMap((point) => [point.done, point.missed, point.planned]));
  const chartY = (value: number) => 90 - value / ceiling * 72;
  const line = (key: 'done' | 'missed' | 'planned') => points.map((point) => `${point.x},${chartY(point[key])}`).join(' ');
  const totalDone = points.reduce((sum, point) => sum + point.done, 0);
  const totalMissed = points.reduce((sum, point) => sum + point.missed, 0);
  const totalPlanned = points.reduce((sum, point) => sum + point.planned, 0);
  const decided = totalDone + totalMissed;
  const completionRate = decided === 0 ? 0 : Math.round(totalDone / decided * 100);
  let currentStreak = 0;
  for (const point of [...points].reverse()) {
    if (point.done === 0) break;
    currentStreak += 1;
  }
  const totalMinutes = props.tracks.reduce((sum, track) => sum + track.minutes, 0);
  const completedLogs = props.activities.filter((activity) => activity.status === 'Completed').length;
  const selectedPoint = points.find((point) => dateKey(point.day) === selectedDayKey) ?? points.at(-1);
  const effectiveSelectedDayKey = selectedPoint ? dateKey(selectedPoint.day) : selectedDayKey;
  const selectedTrackRows = props.tracks.map((track) => ({
    title: track.title,
    status: track.days.find((day) => day.key === effectiveSelectedDayKey)?.status ?? 'empty'
  }));
  const goalRows = props.goals
    .filter((goal) => goal.status === 'Active')
    .map((goal) => {
      const goalActivities = props.activities.filter((activity) => activity.goalId === goal.id && activity.status === 'Completed');
      const target = goal.maintenanceTargetPerWeek ?? 0;
      const execution = target > 0 ? Math.min(100, Math.round(goalActivities.length / target * 100)) : null;
      const progress = goal.targetValue > 0 ? Math.min(100, Math.round(goal.currentValue / goal.targetValue * 100)) : goal.currentValue;
      return { goal, completed: goalActivities.length, minutes: goalActivities.reduce((sum, item) => sum + item.durationMinutes, 0), execution, progress };
    })
    .sort((first, second) => (first.execution ?? first.progress) - (second.execution ?? second.progress));
  const uniqueMetrics = Array.from(props.metrics
    .filter((metric) => metric.isActive)
    .reduce((rows, metric) => {
      const existing = rows.get(metric.name);
      const existingTime = existing?.latestEntry ? new Date(existing.latestEntry.recordedAt).getTime() : 0;
      const candidateTime = metric.latestEntry ? new Date(metric.latestEntry.recordedAt).getTime() : 0;
      if (!existing || candidateTime >= existingTime) rows.set(metric.name, metric);
      return rows;
    }, new Map<string, Metric>()).values());
  const metricRows = uniqueMetrics
    .map((metric) => ({
      metric,
      delta: metric.latestEntry && metric.targetValue != null ? metric.latestEntry.value - metric.targetValue : null
    }))
    .sort((first, second) => Math.abs(second.delta ?? 0) - Math.abs(first.delta ?? 0));
  const attentionTracks = [...props.tracks].sort((first, second) => second.missedCount - first.missedCount || first.completedCount - second.completedCount);
  const headline = completionRate >= 85
    ? 'Momentum is strong. Protect the routine that is already working.'
    : totalMissed > totalDone
      ? 'Recovery mode: close the largest recurring gaps before adding more work.'
      : 'Mixed signal: keep wins stable and repair the top one or two gaps.';

  function toggleSeries(series: keyof typeof visibleSeries) {
    setVisibleSeries((current) => ({ ...current, [series]: !current[series] }));
  }

  function toggleRoutine(title: string) {
    setSelectedRoutines((current) => current.includes(title)
      ? current.filter((item) => item !== title)
      : current.length < 6 ? [...current, title] : current);
  }

  const routineColors = ['#39d9e6', '#ff4da6', '#f5c451', '#8b7dff', '#63dfa1', '#ff7a72'];
  return (
    <div className="momentum-dashboard">
      <div className="signal-command-bar">
        <div><span className="live-dot" /><strong>{headline}</strong></div>
        <div className="segmented-control signal-mode-tabs" aria-label="Signal analysis mode">
          {(['overview', 'goals', 'metrics'] as const).map((item) => (
            <button key={item} className={mode === item ? 'active' : ''} onClick={() => setMode(item)}>{item[0].toUpperCase() + item.slice(1)}</button>
          ))}
        </div>
      </div>
      <div className="signal-view-bar">
        <div><strong>Visualization</strong><span>Switch the chart without changing the selected range</span></div>
        <div className="segmented-control" aria-label="Signal visualization">
          {(['lines', 'bars', 'routines'] as const).map((item) => <button key={item} className={visualization === item ? 'active' : ''} onClick={() => setVisualization(item)}>{item[0].toUpperCase() + item.slice(1)}</button>)}
        </div>
      </div>
      {visualization === 'routines' && <div className="routine-series-picker"><span>Select up to 6 routines</span>{props.tracks.map((track, index) => <button key={track.title} className={selectedRoutines.includes(track.title) ? 'active' : ''} disabled={!selectedRoutines.includes(track.title) && selectedRoutines.length >= 6} style={{ '--series-color': routineColors[index % routineColors.length] } as React.CSSProperties} onClick={() => toggleRoutine(track.title)}><i />{track.title}</button>)}</div>}
      <div className="signal-summary-grid">
        <div className="signal-summary cyan"><span>Completion rate</span><strong>{completionRate}%</strong><i><b style={{ width: `${completionRate}%` }} /></i></div>
        <div className="signal-summary violet"><span>Current streak</span><strong>{currentStreak}d</strong><small>days with a completion</small></div>
        <div className="signal-summary pink"><span>Open gaps</span><strong>{totalMissed}</strong><small>across selected range</small></div>
        <div className="signal-summary amber"><span>Time invested</span><strong>{minutesToHours(totalMinutes)}h</strong><small>{completedLogs} completed logs</small></div>
      </div>

      <div className="momentum-visual-grid">
        <section className="signal-chart-card">
          <div className="signal-card-heading">
            <div><strong>{visualization === 'routines' ? 'Routine performance' : 'Daily execution'}</strong><span>{visualization === 'routines' ? 'Done, planned and missed by routine' : 'Activity count by day'}</span></div>
            {visualization !== 'routines' && <div className="chart-legend interactive">
              <button className={`done ${visibleSeries.done ? 'active' : ''}`} onClick={() => toggleSeries('done')}>Completed</button>
              <button className={`missed ${visibleSeries.missed ? 'active' : ''}`} onClick={() => toggleSeries('missed')}>Gaps</button>
              <button className={`planned ${visibleSeries.planned ? 'active' : ''}`} onClick={() => toggleSeries('planned')}>Planned</button>
            </div>}
          </div>
          {visualization === 'routines' ? (
            <div className="routine-matrix" role="grid" aria-label="Routine status by day">
              <div className="routine-matrix-inner" style={{ '--day-count': props.days.length } as CSSProperties}>
                <strong className="routine-matrix-corner">Routine</strong>
                {props.days.map((day) => <button className={`routine-day-label ${selectedDayKey === dateKey(day) ? 'selected' : ''}`} key={`header-${dateKey(day)}`} onClick={() => setSelectedDayKey(dateKey(day))}><span>{day.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 1)}</span><small>{day.getDate()}</small></button>)}
                {props.tracks.filter((track) => selectedRoutines.includes(track.title)).map((track, trackIndex) => <Fragment key={track.title}>
                  <div className="routine-row-label" title={track.title}><i style={{ background: routineColors[trackIndex % routineColors.length] }} /><span>{track.title}</span></div>
                  {track.days.map((day) => {
                    const status = day.status ?? 'empty';
                    return <button className={`routine-status-cell ${status} ${selectedDayKey === day.key ? 'selected' : ''}`} key={`${track.title}-${day.key}`} aria-label={`${track.title}, ${day.label}: ${status}`} title={`${day.label} · ${track.title}: ${status}`} onClick={() => setSelectedDayKey(day.key)}><span /></button>;
                  })}
                </Fragment>)}
              </div>
            </div>
          ) : <div className="chart-frame">
            <div className="chart-scale"><span>{ceiling}</span><span>{roundNumber(ceiling / 2)}</span><span>0</span></div>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Completed, missed, and planned activities over the selected range">
              <line x1="0" y1="90" x2="100" y2="90" className="chart-axis" />
              {visualization === 'lines' && visibleSeries.planned && <polyline points={line('planned')} className="chart-line planned" />}
              {visualization === 'lines' && visibleSeries.missed && <polyline points={line('missed')} className="chart-line missed" />}
              {visualization === 'lines' && visibleSeries.done && <polyline points={line('done')} className="chart-line done" />}
              {visualization === 'bars' && points.map((point, index) => {
                const width = Math.min(5, 72 / Math.max(1, points.length));
                const offset = width * 1.1;
                return <g key={`bars-${dateKey(point.day)}`} className="signal-bars">
                  {visibleSeries.done && <rect x={point.x - offset} y={chartY(point.done)} width={width} height={90 - chartY(point.done)} className="done" />}
                  {visibleSeries.missed && <rect x={point.x - width / 2} y={chartY(point.missed)} width={width} height={90 - chartY(point.missed)} className="missed" />}
                  {visibleSeries.planned && <rect x={point.x + offset - width} y={chartY(point.planned)} width={width} height={90 - chartY(point.planned)} className="planned" />}
                  <title>{props.days[index].toLocaleDateString()}</title>
                </g>;
              })}
              {points.map((point) => (
                <g key={dateKey(point.day)} className={`chart-day-hit ${selectedDayKey === dateKey(point.day) ? 'selected' : ''}`} onClick={() => setSelectedDayKey(dateKey(point.day))}>
                  <title>{`${point.day.toLocaleDateString()}: ${point.done} completed, ${point.missed} gaps, ${point.planned} planned`}</title>
                  <rect x={Math.max(0, point.x - Math.max(1.5, 45 / points.length))} y="0" width={Math.max(3, 90 / points.length)} height="94" className="chart-hit-zone" />
                  {selectedDayKey === dateKey(point.day) && <line x1={point.x} y1="0" x2={point.x} y2="94" className="chart-selection-line" />}
                  {visualization === 'lines' && visibleSeries.planned && <circle cx={point.x} cy={chartY(point.planned)} r="1.5" className="chart-point planned" />}
                  {visualization === 'lines' && visibleSeries.missed && <circle cx={point.x} cy={chartY(point.missed)} r="1.7" className="chart-point missed" />}
                  {visualization === 'lines' && visibleSeries.done && <circle cx={point.x} cy={chartY(point.done)} r="1.9" className="chart-point done" />}
                </g>
              ))}
            </svg>
          </div>}
          <div className="chart-range"><span>{props.days[0]?.toLocaleDateString()}</span><span>{props.days.at(-1)?.toLocaleDateString()}</span></div>
          <div className="status-color-key">
            <span className="done"><i />Done</span>
            <span className="missed"><i />Missed or skipped</span>
            <span className="planned"><i />Still planned</span>
            <span className="empty"><i />Not scheduled</span>
          </div>
        </section>

        <section className="signal-chart-card decision-card">
          <div className="signal-card-heading"><div><strong>Decision queue</strong><span>What to protect and what to repair</span></div></div>
          <div className="signal-action-list">
            {attentionTracks.slice(0, 6).map((track, index) => {
              const resolved = track.completedCount + track.missedCount;
              const rate = resolved === 0 ? 0 : Math.round(track.completedCount / resolved * 100);
              const state = resolved === 0 ? 'untracked' : track.missedCount > 0 ? 'attention' : 'stable';
              return <article className={state} key={track.title}>
                <b>{String(index + 1).padStart(2, '0')}</b>
                <span><strong>{track.title}</strong><small>{resolved === 0 ? 'No resolved check-ins' : `${track.completedCount} done · ${track.missedCount} gaps`}</small><i><em style={{ width: `${rate}%` }} /></i></span>
                <div><strong>{rate}%</strong><small>{state === 'stable' ? 'Keep' : state === 'attention' ? 'Improve' : 'Log'}</small></div>
              </article>;
            })}
            {attentionTracks.length === 0 && <EmptyState text="Log a routine to generate a decision queue." />}
          </div>
          <div className="decision-strip">
            <div><span>Done signals</span><strong>{totalDone}</strong></div>
            <div><span>Gaps</span><strong>{totalMissed}</strong></div>
            <div><span>Upcoming</span><strong>{totalPlanned}</strong></div>
          </div>
        </section>
      </div>

      <section className="signal-inspector" aria-live="polite">
        {mode === 'overview' && (
          <>
            <div className="inspector-heading">
              <div><span>Selected day</span><strong>{selectedPoint?.day.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</strong></div>
              <div className="inspector-day-totals"><b className="done">{selectedPoint?.done ?? 0} done</b><b className="missed">{selectedPoint?.missed ?? 0} gaps</b><b className="planned">{selectedPoint?.planned ?? 0} planned</b></div>
            </div>
            <div className="signal-status-matrix">
              {selectedTrackRows.map((row) => <button key={row.title} className={row.status} title={`${row.title}: ${row.status}`}><i />{row.title}<span>{row.status}</span></button>)}
            </div>
            <div className="attention-list">
              <div className="inspector-subtitle"><strong>Priority diagnosis</strong><span>Sorted by recurring gaps</span></div>
              {attentionTracks.slice(0, 4).map((track, index) => (
                <div className="attention-row" key={track.title}><b>{String(index + 1).padStart(2, '0')}</b><span><strong>{track.title}</strong><small>{track.missedCount > 0 ? `${track.missedCount} gaps need attention` : `${track.completedCount} completions · stable`}</small></span><em className={track.missedCount > 0 ? 'warning' : 'good'}>{track.missedCount > 0 ? 'Improve' : 'Keep'}</em></div>
              ))}
            </div>
          </>
        )}
        {mode === 'goals' && (
          <div className="analysis-table">
            <div className="inspector-subtitle"><strong>Goal execution</strong><span>Lowest execution signal first</span></div>
            {goalRows.map((row) => (
              <article key={row.goal.id}>
                <i style={{ background: row.goal.lifeAreaColor }} />
                <span><strong>{row.goal.title}</strong><small>{row.goal.lifeAreaName} · {row.completed} completions · {row.minutes}m</small></span>
                <div><b style={{ width: `${row.execution ?? row.progress}%` }} /></div>
                <em>{row.execution == null ? `${row.progress}% progress` : `${row.execution}% execution`}</em>
              </article>
            ))}
            {goalRows.length === 0 && <EmptyState text="No active goals to analyze." />}
          </div>
        )}
        {mode === 'metrics' && (
          <div className="analysis-table metrics-analysis">
            <div className="inspector-subtitle"><strong>Metric radar</strong><span>Latest value compared with target</span></div>
            {metricRows.map(({ metric, delta }) => (
              <article key={metric.id}>
                <i />
                <span><strong>{metric.name}</strong><small>{metric.latestEntry ? `Updated ${formatShortDate(metric.latestEntry.recordedAt)}` : 'No data logged'}</small></span>
                <div><b style={{ width: `${metric.latestEntry && metric.targetValue ? Math.min(100, Math.abs(metric.latestEntry.value / metric.targetValue * 100)) : 0}%` }} /></div>
                <em>{metric.latestEntry ? `${metric.latestEntry.value} ${metric.unit}${delta == null ? '' : ` · ${delta > 0 ? '+' : ''}${roundNumber(delta)} vs target`}` : 'Missing'}</em>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function CalendarPage(props: {
  areas: LifeArea[];
  goals: Goal[];
  activities: Activity[];
  busy: boolean;
  onSave: (activity: unknown, id?: string) => void;
  onComplete: (id: string) => void;
  onSkip: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [selected, setSelected] = useState<Activity | null>(null);
  const [groupedActivities, setGroupedActivities] = useState<Activity[] | null>(null);
  const [view, setView] = useState<CalendarView>('week');
  const [anchorDate, setAnchorDate] = useState(() => startOfDay(new Date()));
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [areaFilter, setAreaFilter] = useState('');
  const [agendaExpanded, setAgendaExpanded] = useState(false);
  const visibleDays = useMemo(() => getCalendarDays(view, anchorDate), [view, anchorDate]);
  const monthDays = useMemo(() => buildMonthGrid(anchorDate), [anchorDate]);
  const rangeLabel = useMemo(() => formatCalendarRange(view, anchorDate), [view, anchorDate]);
  const scopedActivities = useMemo(
    () => props.activities.filter((activity) => visibleDays.some((day) => sameDay(getActivityDate(activity), day))),
    [props.activities, visibleDays]
  );
  const monthActivities = useMemo(
    () => props.activities.filter((activity) => sameMonth(getActivityDate(activity), anchorDate)),
    [props.activities, anchorDate]
  );
  const filteredActivities = (view === 'month' ? monthActivities : scopedActivities).filter((activity) => {
    const text = `${activity.title} ${activity.description} ${activity.lifeAreaName} ${activity.goalTitle ?? ''}`.toLowerCase();
    return (!query || text.includes(query.toLowerCase()))
      && (!statusFilter || activity.status === statusFilter)
      && (!areaFilter || activity.lifeAreaId === areaFilter);
  });
  const agendaActivities = agendaExpanded ? filteredActivities : filteredActivities.slice(0, 12);

  function move(offset: number) {
    setAnchorDate((current) => {
      if (view === 'day') return addDays(current, offset);
      if (view === 'week') return addDays(current, offset * 7);
      return addMonths(current, offset);
    });
  }

  function openNewActivity(day: Date, hour = 9) {
    const start = new Date(day);
    start.setHours(hour, 0, 0, 0);
    setSelected({
      id: '',
      lifeAreaId: props.areas[0]?.id ?? '',
      lifeAreaName: props.areas[0]?.name ?? '',
      lifeAreaColor: props.areas[0]?.color ?? '#64748b',
      title: '',
      description: '',
      plannedStartAt: start.toISOString(),
      plannedEndAt: new Date(start.getTime() + 45 * 60000).toISOString(),
      durationMinutes: 45,
      status: 'Planned',
      energyCost: 'Medium',
      mentalLoad: 'Medium',
      physicalLoad: 'Low',
      points: 5,
      notes: ''
    });
  }

  return (
    <section className="workspace-grid drawer-workspace">
      <div className="workspace-main">
        <section className="calendar-surface">
          <div className="calendar-toolbar">
            <div>
              <p className="eyebrow">Planner</p>
              <h3>{rangeLabel}</h3>
            </div>
            <div className="calendar-controls">
              <button onClick={() => openNewActivity(anchorDate)}>New activity</button>
              <button className="secondary-button" onClick={() => move(-1)} aria-label="Previous period">‹</button>
              <button className="secondary-button" onClick={() => setAnchorDate(startOfDay(new Date()))}>Today</button>
              <button className="secondary-button" onClick={() => move(1)} aria-label="Next period">›</button>
              <div className="segmented-control" aria-label="Calendar view">
                {(['day', 'week', 'month'] as CalendarView[]).map((item) => (
                  <button
                    key={item}
                    className={view === item ? 'active' : ''}
                    onClick={() => setView(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="filter-bar">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search activities" />
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="">All statuses</option>
              {activityStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
            <select value={areaFilter} onChange={(event) => setAreaFilter(event.target.value)}>
              <option value="">All areas</option>
              {props.areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
            </select>
          </div>

          {view === 'month' ? (
            <MonthCalendar
              anchorDate={anchorDate}
              days={monthDays}
              activities={filteredActivities}
              onOpen={setSelected}
              onCreate={(day) => openNewActivity(day)}
              onFocusDay={(day) => {
                setAnchorDate(day);
                setView('day');
              }}
            />
          ) : (
            <TimeGridCalendar
              days={visibleDays}
              activities={filteredActivities}
              onOpen={(activity) => {
                setGroupedActivities(null);
                setSelected(activity);
              }}
              onOpenGroup={(activities) => {
                setSelected(null);
                setGroupedActivities(activities);
              }}
              onCreate={openNewActivity}
            />
          )}

          <CalendarReviewPanel
            title={view === 'month' ? 'Month review' : 'Plan review'}
            activities={filteredActivities}
            busy={props.busy}
            onOpen={setSelected}
            onComplete={props.onComplete}
            onSkip={props.onSkip}
          />
        </section>

        <section className="surface">
          <div className="collection-header flush-header">
            <SectionTitle kicker={view === 'month' ? 'Selected month' : 'Visible range'} title="Agenda" />
            {filteredActivities.length > 12 && <button className="secondary-button" onClick={() => setAgendaExpanded((current) => !current)}>{agendaExpanded ? 'Show less' : `Show all ${filteredActivities.length}`}</button>}
          </div>
          <ActivityList
            activities={agendaActivities}
            busy={props.busy}
            onComplete={props.onComplete}
            onSkip={props.onSkip}
            onEdit={setSelected}
            onDelete={(id) => confirmDelete('Delete this activity?') && props.onDelete(id)}
          />
        </section>
      </div>

      <EditorDrawer open={selected !== null || groupedActivities !== null} label={groupedActivities ? 'Grouped calendar entries' : selected?.id ? 'Edit activity' : 'Create activity'} onClose={() => {
        setSelected(null);
        setGroupedActivities(null);
      }}>
        {groupedActivities ? <CalendarGroupPanel activities={groupedActivities} busy={props.busy} onComplete={props.onComplete} onSkip={props.onSkip} onClose={() => setGroupedActivities(null)} onEdit={(activity) => {
          setGroupedActivities(null);
          setSelected(activity);
        }} onDelete={(activity) => {
          if (confirmDelete(`Delete ${activity.title}?`)) props.onDelete(activity.id);
          setGroupedActivities((current) => current?.filter((item) => item.id !== activity.id) ?? null);
        }} /> : <ActivityForm
          key={`${selected?.id || 'new-activity'}-${selected?.plannedStartAt ?? ''}`}
          activity={selected}
          areas={props.areas}
          goals={props.goals}
          busy={props.busy}
          onComplete={props.onComplete}
          onSkip={props.onSkip}
          onCancel={() => setSelected(null)}
          onDelete={selected?.id ? () => {
            if (confirmDelete('Delete this activity?')) props.onDelete(selected.id);
            setSelected(null);
          } : undefined}
          onSave={(body) => {
            props.onSave(body, selected?.id || undefined);
            setSelected(null);
          }}
        />}
      </EditorDrawer>
    </section>
  );
}

function TimeGridCalendar(props: {
  days: Date[];
  activities: Activity[];
  onOpen: (activity: Activity) => void;
  onOpenGroup: (activities: Activity[]) => void;
  onCreate: (day: Date, hour: number) => void;
}) {
  const hours = Array.from({ length: 18 }, (_, index) => index + 6);

  return (
    <div className="time-calendar">
      <div className="time-header" style={{ gridTemplateColumns: `72px repeat(${props.days.length}, minmax(132px, 1fr))` }}>
        <span />
        {props.days.map((day) => (
          <button className={isToday(day) ? 'time-day-heading today' : 'time-day-heading'} key={dateKey(day)} onClick={() => props.onCreate(day, 9)}>
            <span>{day.toLocaleDateString(undefined, { weekday: 'short' })}</span>
            <strong>{day.getDate()}</strong>
          </button>
        ))}
      </div>
      <div className="time-body" style={{ gridTemplateColumns: `72px repeat(${props.days.length}, minmax(132px, 1fr))` }}>
        <div className="time-axis">
          {hours.map((hour) => <span key={hour}>{formatHour(hour)}</span>)}
        </div>
        {props.days.map((day) => (
          <div className="time-column" key={dateKey(day)}>
            {hours.map((hour) => (
              <button className="time-slot" key={hour} onClick={() => props.onCreate(day, hour)} aria-label={`Create activity at ${formatHour(hour)}`} />
            ))}
            {groupCalendarActivities(props.activities.filter((activity) => sameDay(getActivityDate(activity), day))).map((group) => group.length === 1 ? (
              <button className="calendar-event" key={group[0].id} style={{ ...eventStyle(group[0]), borderColor: group[0].lifeAreaColor }} data-status={group[0].status.toLowerCase()} onClick={() => props.onOpen(group[0])}>
                <strong>{group[0].title}</strong>
                <span>{formatTime(getActivityDate(group[0]))} · {activityDisplayMeasure(group[0])}</span>
              </button>
            ) : (
              <button className="calendar-event calendar-event-group" key={group.map((activity) => activity.id).join('-')} style={{ ...eventStyle(group[0]), borderColor: group[0].lifeAreaColor, minHeight: 52 }} onClick={() => props.onOpenGroup(group)}>
                <strong>{group.length} grouped entries</strong>
                <span>{formatTime(getActivityDate(group[0]))} · {Array.from(new Set(group.map((activity) => activity.title))).slice(0, 2).join(', ')}{group.length > 2 ? '…' : ''}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function MonthCalendar(props: {
  anchorDate: Date;
  days: Date[];
  activities: Activity[];
  onOpen: (activity: Activity) => void;
  onCreate: (day: Date) => void;
  onFocusDay: (day: Date) => void;
}) {
  const weekdayLabels = getCalendarDays('week', props.anchorDate).map((day) => day.toLocaleDateString(undefined, { weekday: 'short' }));

  return (
    <div className="month-calendar">
      <div className="month-weekdays">
        {weekdayLabels.map((label) => <span key={label}>{label}</span>)}
      </div>
      <div className="month-grid">
        {props.days.map((day) => {
          const dayActivities = props.activities
            .filter((activity) => sameDay(getActivityDate(activity), day))
            .sort(compareActivities)
            .slice(0, 4);

          return (
            <div className={sameMonth(day, props.anchorDate) ? 'month-cell' : 'month-cell outside'} key={dateKey(day)}>
              <div className="month-cell-header">
                <button className={isToday(day) ? 'month-date today' : 'month-date'} onClick={() => props.onFocusDay(day)}>{day.getDate()}</button>
                <button className="ghost-button" onClick={() => props.onCreate(day)}>+</button>
              </div>
              <div className="month-events">
                {dayActivities.map((activity) => (
                  <button className="month-event" data-status={activity.status.toLowerCase()} key={activity.id} onClick={() => props.onOpen(activity)}>
                    <i style={{ background: activity.lifeAreaColor }} />
                    <span>{formatTime(getActivityDate(activity))}</span>
                    <strong>{activity.title}</strong>
                  </button>
                ))}
                {props.activities.filter((activity) => sameDay(getActivityDate(activity), day)).length > 4 && (
                  <button className="more-events" onClick={() => props.onFocusDay(day)}>More</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CalendarReviewPanel(props: {
  title: string;
  activities: Activity[];
  busy: boolean;
  onOpen: (activity: Activity) => void;
  onComplete: (id: string) => void;
  onSkip: (id: string) => void;
}) {
  const today = startOfDay(new Date()).getTime();
  const sorted = props.activities
    .filter((activity) => {
      const isSkipped = activity.status === 'Skipped' || activity.status === 'Cancelled';
      const isOpen = activity.status === 'Planned' || activity.status === 'Moved';
      const activityDate = getActivityDate(activity);
      return isSkipped || (isOpen && (!activityDate || startOfDay(new Date(activityDate)).getTime() <= today));
    })
    .sort(compareActivities);
  const visibleRows = sorted.slice(0, 12);
  const planned = sorted.filter((activity) => activity.status === 'Planned' || activity.status === 'Moved').length;
  const skipped = sorted.filter((activity) => activity.status === 'Skipped' || activity.status === 'Cancelled').length;

  return (
    <div className="calendar-review">
      <div className="review-summary">
        <div>
          <p className="eyebrow">Catch-up</p>
          <h4>Anything you forgot to log?</h4>
          <p className="helper-copy">Past unresolved and skipped items appear here. Mark them done or skipped directly; use Edit details only when the time or notes need correction.</p>
        </div>
        <div className="review-stats">
          <SummaryPill label="Planned" value={planned} />
          <SummaryPill label="Needs review" value={skipped} />
        </div>
      </div>
      <div className="review-list">
        {visibleRows.map((activity) => (
          <div className="review-row" key={activity.id}>
            <i style={{ background: activity.lifeAreaColor }} />
            <button className="review-title" onClick={() => props.onOpen(activity)}>
              <strong>{activity.title}</strong>
              <span>{formatShortDate(getActivityDate(activity))} · {formatTime(getActivityDate(activity))} · {activity.lifeAreaName}</span>
            </button>
            <span className={`status-badge ${activity.status.toLowerCase()}`}>{activity.status}</span>
            <div className="row-actions">
              <button disabled={props.busy || !canCompleteActivity(activity)} onClick={() => props.onComplete(activity.id)}>{activity.status === 'Skipped' || activity.status === 'Cancelled' ? 'Mark done' : 'Done'}</button>
              {(activity.status === 'Planned' || activity.status === 'Moved') && <button className="secondary-button" disabled={props.busy} onClick={() => props.onSkip(activity.id)}>Skip</button>}
              <button className="secondary-button" onClick={() => props.onOpen(activity)}>Edit details</button>
            </div>
          </div>
        ))}
        {sorted.length > visibleRows.length && <p className="helper-copy">Showing the next {visibleRows.length} of {sorted.length} items. Use Agenda below to expand the full range.</p>}
        {sorted.length === 0 && <EmptyState text="Nothing needs catch-up in this range." />}
      </div>
    </div>
  );
}

function LifeLessonsPage(props: { lessons: LifeLesson[]; busy: boolean; onSave: (body: unknown, id?: string) => void; onDelete: (id: string) => void }) {
  const [selected, setSelected] = useState<LifeLesson | null>(null);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const categories = Array.from(new Set(props.lessons.map((item) => item.category).filter(Boolean))).sort();
  const filtered = props.lessons.filter((item) => (!query || `${item.title} ${item.content} ${item.source}`.toLowerCase().includes(query.toLowerCase())) && (!category || item.category === category));
  const paged = paginate(filtered, page, defaultPageSize);
  useEffect(() => setPage(1), [query, category]);
  return <section className="workspace-grid drawer-workspace lessons-page"><div className="workspace-main"><section className="collection-header"><div><p className="eyebrow">Personal operating manual</p><h3>{props.lessons.length} life lessons</h3></div><button onClick={() => { setSelected(null); setCreating(true); }}>Add lesson</button></section>
    <div className="filter-bar"><input placeholder="Search lessons" value={query} onChange={(event) => setQuery(event.target.value)} /><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">All categories</option>{categories.map((item) => <option key={item}>{item}</option>)}</select></div>
    <div className="lesson-grid">{paged.items.map((item) => <article className={`entity-card lesson-card ${item.isPinned ? 'pinned' : ''}`} key={item.id}><div className="entity-card-top"><span className="color-chip">{item.category || 'Life'}</span>{item.isPinned && <strong>PINNED</strong>}</div><h3>{item.title}</h3><blockquote>{item.content}</blockquote>{item.source && <p className="muted-copy">Source: {item.source}</p>}<small>{formatShortDate(item.createdAt)}</small><div className="card-actions"><button className="secondary-button" onClick={() => { setSelected(item); setCreating(false); }}>Edit</button><button className="danger-button" onClick={() => confirmDelete('Delete this lesson?') && props.onDelete(item.id)}>Delete</button></div></article>)}</div>
    {filtered.length === 0 && <EmptyState text="No lessons match this search." />}<PaginationControls page={page} totalPages={paged.totalPages} totalItems={filtered.length} onPage={setPage} /></div>
    <EditorDrawer open={creating || selected !== null} label={selected ? 'Edit life lesson' : 'Add life lesson'} onClose={() => { setCreating(false); setSelected(null); }}><LifeLessonForm lesson={selected} busy={props.busy} onSave={(body) => { props.onSave(body, selected?.id); setCreating(false); setSelected(null); }} /></EditorDrawer></section>;
}

function LifeLessonForm(props: { lesson: LifeLesson | null; busy: boolean; onSave: (body: unknown) => void }) {
  const [draft, setDraft] = useState({ title: props.lesson?.title ?? '', content: props.lesson?.content ?? '', category: props.lesson?.category ?? '', source: props.lesson?.source ?? '', isPinned: props.lesson?.isPinned ?? false });
  return <form className="editor-form" onSubmit={(event) => { event.preventDefault(); props.onSave(draft); }}><TextField label="Lesson title" value={draft.title} onChange={(title) => setDraft({ ...draft, title })} required /><TextArea label="Advice to future me" value={draft.content} onChange={(content) => setDraft({ ...draft, content })} /><TextField label="Category" value={draft.category} onChange={(category) => setDraft({ ...draft, category })} /><TextField label="Source or situation" value={draft.source} onChange={(source) => setDraft({ ...draft, source })} /><label className="toggle-field"><input type="checkbox" checked={draft.isPinned} onChange={(event) => setDraft({ ...draft, isPinned: event.target.checked })} /><span>Pin this lesson</span></label><button disabled={props.busy}>Save lesson</button></form>;
}

function MoneyPage(props: { savings: SavingsEntry[]; wishlist: WishlistItem[]; busy: boolean; onSaveSavings: (body: unknown, id?: string) => void; onDeleteSavings: (id: string) => void; onSaveWish: (body: unknown, id?: string) => void; onDeleteWish: (id: string) => void }) {
  const [mode, setMode] = useState<'wishlist' | 'savings'>('wishlist');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('active');
  const [page, setPage] = useState(1);
  const [wish, setWish] = useState<WishlistItem | null>(null);
  const [saving, setSaving] = useState<SavingsEntry | null>(null);
  const [creating, setCreating] = useState(false);
  const currentSavings = props.savings[0]?.amount ?? 0;
  const activeTotal = props.wishlist.filter((item) => !item.isPurchased).reduce((sum, item) => sum + item.price, 0);
  const purchasedTotal = props.wishlist.filter((item) => item.isPurchased).reduce((sum, item) => sum + item.price, 0);
  const coverage = activeTotal <= 0 ? 0 : Math.min(100, Math.round(currentSavings / activeTotal * 100));
  const filteredWish = props.wishlist.filter((item) => (!query || `${item.name} ${item.description}`.toLowerCase().includes(query.toLowerCase())) && (filter === 'all' || (filter === 'done' ? item.isPurchased : !item.isPurchased)));
  const filteredSavings = props.savings.filter((item) => !query || item.note.toLowerCase().includes(query.toLowerCase()));
  const pagedWish = paginate(filteredWish, page, defaultPageSize);
  const pagedSavings = paginate(filteredSavings, page, defaultPageSize);
  useEffect(() => setPage(1), [query, filter, mode]);
  return <section className="workspace-grid drawer-workspace money-page"><div className="workspace-main"><section className="money-hero"><div><p className="eyebrow">Capital dashboard</p><h3>{formatMoney(currentSavings)} saved</h3><p>{coverage}% of the active wishlist is covered.</p></div><div className="money-orbit" style={{ '--money-progress': `${coverage * 3.6}deg` } as React.CSSProperties}><strong>{coverage}%</strong><span>coverage</span></div></section>
    <div className="money-metrics"><SummaryPill label="Saved" value={formatMoney(currentSavings)} /><SummaryPill label="Wishlist" value={formatMoney(activeTotal)} /><SummaryPill label="Purchased" value={formatMoney(purchasedTotal)} /><SummaryPill label="Items" value={props.wishlist.length} /></div>
    <MoneyTrajectoryChart entries={props.savings} wishlistTotal={activeTotal} />
    <div className="collection-header"><div className="segmented-control"><button className={mode === 'wishlist' ? 'active' : ''} onClick={() => setMode('wishlist')}>Wishlist</button><button className={mode === 'savings' ? 'active' : ''} onClick={() => setMode('savings')}>Savings log</button></div><button onClick={() => { setWish(null); setSaving(null); setCreating(true); }}>{mode === 'wishlist' ? 'Add wish' : 'Record balance'}</button></div>
    <div className="filter-bar"><input placeholder={`Search ${mode}`} value={query} onChange={(event) => setQuery(event.target.value)} />{mode === 'wishlist' && <select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="active">Wishlist</option><option value="done">Purchased</option><option value="all">All</option></select>}</div>
    {mode === 'wishlist' ? <div className="entity-grid">{pagedWish.items.map((item) => <article className={`entity-card money-item ${item.isPurchased ? 'purchased' : ''}`} key={item.id}><div className="entity-card-top"><span>Priority {item.priority}</span><strong>{formatMoney(item.price)}</strong></div><h3>{item.name}</h3><p>{item.description || 'No notes.'}</p><div className="meter"><i style={{ width: `${Math.min(100, currentSavings / Math.max(1, item.price) * 100)}%` }} /></div><small>{item.isPurchased ? `Purchased ${formatShortDate(item.purchasedAt ?? undefined)}` : currentSavings >= item.price ? 'Affordable from current savings' : `${formatMoney(item.price - currentSavings)} still needed`}</small><div className="card-actions"><button onClick={() => props.onSaveWish({ name: item.name, description: item.description, price: item.price, priority: item.priority, isPurchased: !item.isPurchased }, item.id)}>{item.isPurchased ? 'Return to wishlist' : 'Mark purchased'}</button><button className="secondary-button" onClick={() => { setWish(item); setSaving(null); setCreating(false); }}>Edit</button><button className="danger-button" onClick={() => props.onDeleteWish(item.id)}>Delete</button></div></article>)}</div> : <div className="history-timeline">{pagedSavings.items.map((item) => <article className="timeline-entry" key={item.id}><time>{formatShortDate(item.recordedAt)}</time><div><h4>{formatMoney(item.amount)}</h4><p>{item.note || 'Balance update'}</p></div><div className="row-actions"><button className="secondary-button" onClick={() => { setSaving(item); setWish(null); setCreating(false); }}>Edit</button><button className="danger-button" onClick={() => props.onDeleteSavings(item.id)}>Delete</button></div></article>)}</div>}
    {(mode === 'wishlist' ? pagedWish.items.length : pagedSavings.items.length) === 0 && <EmptyState text="Nothing matches this view." />}<PaginationControls page={page} totalPages={mode === 'wishlist' ? pagedWish.totalPages : pagedSavings.totalPages} totalItems={mode === 'wishlist' ? filteredWish.length : filteredSavings.length} onPage={setPage} /></div>
    <EditorDrawer open={creating || wish !== null || saving !== null} label={mode === 'wishlist' ? 'Wishlist item' : 'Savings balance'} onClose={() => { setCreating(false); setWish(null); setSaving(null); }}>{mode === 'wishlist' ? <WishlistForm item={wish} busy={props.busy} onSave={(body) => { props.onSaveWish(body, wish?.id); setCreating(false); setWish(null); }} /> : <SavingsForm entry={saving} busy={props.busy} onSave={(body) => { props.onSaveSavings(body, saving?.id); setCreating(false); setSaving(null); }} />}</EditorDrawer>
  </section>;
}

function MoneyTrajectoryChart({ entries, wishlistTotal }: { entries: SavingsEntry[]; wishlistTotal: number }) {
  const [mode, setMode] = useState<'line' | 'bars'>('line');
  const rows = [...entries].sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());
  const values = rows.map((item) => item.amount);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values, wishlistTotal) : Math.max(1, wishlistTotal);
  const range = Math.max(1, max - Math.min(0, min));
  const y = (value: number) => 34 - (value - Math.min(0, min)) / range * 30;
  const x = (index: number) => rows.length <= 1 ? 50 : index / (rows.length - 1) * 100;
  const delta = rows.length > 1 ? rows.at(-1)!.amount - rows[0].amount : 0;
  return <section className="surface money-trend professional-chart"><div className="collection-header flush-header"><SectionTitle kicker="Savings history" title="Capital trajectory" /><div className="segmented-control compact"><button className={mode === 'line' ? 'active' : ''} onClick={() => setMode('line')}>Line</button><button className={mode === 'bars' ? 'active' : ''} onClick={() => setMode('bars')}>Bars</button></div></div><div className="chart-insight-strip"><span><small>Current</small><strong>{formatMoney(rows.at(-1)?.amount ?? 0)}</strong></span><span><small>Change</small><strong>{delta >= 0 ? '+' : ''}{formatMoney(delta)}</strong></span><span><small>Highest</small><strong>{formatMoney(values.length ? Math.max(...values) : 0)}</strong></span><span><small>Wishlist target</small><strong>{formatMoney(wishlistTotal)}</strong></span></div><div className="axis-chart money-axis"><div className="axis-labels"><span>{formatMoney(max)}</span><span>{formatMoney(max / 2)}</span><span>{formatMoney(0)}</span></div><svg viewBox="0 0 100 36" preserveAspectRatio="none" aria-label="Savings balance in EUR over time"><line x1="0" x2="100" y1={y(wishlistTotal)} y2={y(wishlistTotal)} className="sparkline-target"><title>Wishlist target {formatMoney(wishlistTotal)}</title></line>{mode === 'line' ? <polyline points={moneySparklinePoints(rows)} /> : rows.map((item, index) => <rect key={item.id} x={x(index) - Math.min(2, 35 / Math.max(1, rows.length))} y={y(item.amount)} width={Math.min(4, 70 / Math.max(1, rows.length))} height={34 - y(item.amount)}><title>{formatShortDate(item.recordedAt)}: {formatMoney(item.amount)}</title></rect>)}{rows.map((item, index) => <circle key={`point-${item.id}`} cx={x(index)} cy={y(item.amount)} r="1.1"><title>{formatDateTime(item.recordedAt)}: {formatMoney(item.amount)}</title></circle>)}</svg></div><div className="chart-range"><span>{rows[0] ? formatShortDate(rows[0].recordedAt) : 'No balances yet'}</span><span>EUR · {rows.length} balance records</span><span>{rows.at(-1) ? formatShortDate(rows.at(-1)!.recordedAt) : ''}</span></div></section>;
}

function WishlistForm(props: { item: WishlistItem | null; busy: boolean; onSave: (body: unknown) => void }) { const [draft, setDraft] = useState({ name: props.item?.name ?? '', description: props.item?.description ?? '', price: props.item?.price ?? 0, priority: props.item?.priority ?? 3, isPurchased: props.item?.isPurchased ?? false }); return <form className="editor-form" onSubmit={(event) => { event.preventDefault(); props.onSave(draft); }}><TextField label="Item" value={draft.name} onChange={(name) => setDraft({ ...draft, name })} required /><TextArea label="Why I want it" value={draft.description} onChange={(description) => setDraft({ ...draft, description })} /><NumberField label="Price" value={draft.price} onChange={(price) => setDraft({ ...draft, price })} /><NumberField label="Priority 1-5" value={draft.priority} onChange={(priority) => setDraft({ ...draft, priority })} /><label className="toggle-field"><input type="checkbox" checked={draft.isPurchased} onChange={(event) => setDraft({ ...draft, isPurchased: event.target.checked })} /><span>Purchased</span></label><button disabled={props.busy}>Save item</button></form>; }
function SavingsForm(props: { entry: SavingsEntry | null; busy: boolean; onSave: (body: unknown) => void }) { const [amount, setAmount] = useState(props.entry?.amount ?? 0); const [note, setNote] = useState(props.entry?.note ?? ''); return <form className="editor-form" onSubmit={(event) => { event.preventDefault(); props.onSave({ amount, note }); }}><NumberField label="Current saved amount" value={amount} onChange={setAmount} /><TextField label="Note" value={note} onChange={setNote} /><small className="helper-copy">A new balance creates a point on the savings chart.</small><button disabled={props.busy}>Record balance</button></form>; }

function CountdownsPage(props: {
  countdowns: Countdown[];
  busy: boolean;
  onSave: (countdown: unknown, id?: string) => void;
  onDelete: (id: string) => void;
}) {
  const [selected, setSelected] = useState<Countdown | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState('active');
  const [page, setPage] = useState(1);
  const categories = Array.from(new Set(props.countdowns.map((countdown) => countdown.category).filter(Boolean))).sort();
  const filtered = props.countdowns.filter((countdown) => {
    const text = `${countdown.title} ${countdown.description} ${countdown.category}`.toLowerCase();
    return (!query || text.includes(query.toLowerCase()))
      && (!categoryFilter || countdown.category === categoryFilter)
      && (visibilityFilter === 'all' || (visibilityFilter === 'archived' ? countdown.isArchived : !countdown.isArchived));
  });
  const paged = paginate(filtered, page, defaultPageSize);

  useEffect(() => {
    setPage(1);
  }, [query, categoryFilter, visibilityFilter]);

  return (
    <section className="workspace-grid drawer-workspace countdowns-page">
      <div className="workspace-main">
        <section className="collection-header">
          <div>
            <p className="eyebrow">Release radar</p>
            <h3>{props.countdowns.length} countdowns</h3>
          </div>
          <button onClick={() => {
            setSelected(null);
            setIsCreating(true);
          }}>New countdown</button>
        </section>

        <div className="filter-bar">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search countdowns" />
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
            <option value="">All categories</option>
            {categories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
          <select value={visibilityFilter} onChange={(event) => setVisibilityFilter(event.target.value)}>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
            <option value="all">All</option>
          </select>
        </div>

        <div className="entity-grid countdown-grid">
          {paged.items.map((countdown) => (
            <article className={countdown.isPast ? 'entity-card countdown-card elapsed' : 'entity-card countdown-card'} style={{ '--countdown-color': countdown.color, '--countdown-progress': `${countdownProgress(countdown) * 3.6}deg` } as React.CSSProperties} key={countdown.id}>
              <i className="countdown-scan" aria-hidden="true" />
              <div className="entity-card-top">
                <strong>{countdown.title}</strong>
                <span>{countdown.category || 'Countdown'}</span>
              </div>
              <div className="countdown-stage">
                <div className="countdown-orbit"><span>{countdown.isPast ? '✓' : countdown.daysRemaining}</span><small>{countdown.isPast ? 'arrived' : 'days'}</small></div>
                <div className="countdown-clock"><div><strong>{String(countdown.hoursRemaining).padStart(2, '0')}</strong><span>hours</span></div><b>:</b><div><strong>{String(countdown.minutesRemaining).padStart(2, '0')}</strong><span>minutes</span></div></div>
              </div>
              <p>{countdown.description || 'No notes yet.'}</p>
              <div className="countdown-interval"><strong>{countdown.totalDurationDays ?? Math.max(0, Math.round((new Date(countdown.targetAt).getTime() - new Date(countdown.createdAt ?? Date.now()).getTime()) / 86400000))} days total</strong><span>{countdown.calendarMonths ?? 0} months, {countdown.calendarDays ?? 0} days · {countdown.elapsedDays ?? 0} elapsed</span></div>
              <dl className="compact-dl">
                <div><dt>Target</dt><dd>{formatDateTime(countdown.targetAt)}</dd></div>
                <div><dt>Pinned</dt><dd>{countdown.isPinned ? 'Yes' : 'No'}</dd></div>
                <div><dt>Status</dt><dd>{countdown.isArchived ? 'Archived' : 'Active'}</dd></div>
              </dl>
              <div className="card-actions">
                <button className="secondary-button" onClick={() => {
                  setIsCreating(false);
                  setSelected(countdown);
                }}>Edit</button>
                <button className="danger-button" onClick={() => confirmDelete('Delete this countdown?') && props.onDelete(countdown.id)}>Delete</button>
              </div>
            </article>
          ))}
          {filtered.length === 0 && <EmptyState text="No countdowns match the current filters." />}
        </div>
        <PaginationControls page={page} totalPages={paged.totalPages} totalItems={filtered.length} onPage={setPage} />
      </div>

      <EditorDrawer open={isCreating || selected !== null} label={selected ? 'Edit countdown' : 'Create countdown'} onClose={() => {
        setSelected(null);
        setIsCreating(false);
      }}>
        <CountdownForm
          key={selected?.id ?? 'new-countdown'}
          countdown={selected}
          busy={props.busy}
          onSave={(body) => {
            props.onSave(body, selected?.id);
            setSelected(null);
            setIsCreating(false);
          }}
          onCancel={() => {
            setSelected(null);
            setIsCreating(false);
          }}
        />
      </EditorDrawer>
    </section>
  );
}

function CalendarGroupPanel(props: { activities: Activity[]; busy: boolean; onComplete: (id: string) => void; onSkip: (id: string) => void; onEdit: (activity: Activity) => void; onDelete: (activity: Activity) => void; onClose: () => void }) {
  return <EditorShell title={`${props.activities.length} grouped entries`} onCancel={props.onClose}>
    <p className="helper-copy">These entries were logged within a few minutes of each other, so the calendar combines them into one block.</p>
    <div className="grouped-calendar-list">{props.activities.map((activity) => <div key={activity.id}>
      <span><strong>{activity.title}</strong><small>{formatTime(getActivityDate(activity))} · {activityDisplayMeasure(activity)} · {activity.status}</small></span>
      <div className="row-actions">
        {activity.status !== 'Completed' && <button disabled={props.busy || !canCompleteActivity(activity)} onClick={() => props.onComplete(activity.id)}>Done</button>}
        {activity.status === 'Completed' && <button className="secondary-button" disabled={props.busy} onClick={() => props.onSkip(activity.id)}>Mark skipped</button>}
        {(activity.status === 'Planned' || activity.status === 'Moved') && <button className="secondary-button" disabled={props.busy} onClick={() => props.onSkip(activity.id)}>Skip</button>}
        <button className="secondary-button" onClick={() => props.onEdit(activity)}>Edit</button><button className="danger-button" onClick={() => props.onDelete(activity)}>Delete</button>
      </div>
    </div>)}</div>
  </EditorShell>;
}

function PhysiquePage(props: {
  entries: PhysiqueEntry[];
  busy: boolean;
  onSave: (entry: unknown, id?: string) => void;
  onDelete: (id: string) => void;
}) {
  const [selected, setSelected] = useState<PhysiqueEntry | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [query, setQuery] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const latest = props.entries[0];
  const filtered = props.entries.filter((entry) => {
    const text = `${entry.status} ${entry.notes} ${entry.weightKg} ${entry.estimatedBodyFatPercent ?? ''}`.toLowerCase();
    const entryDate = localDateKey(entry.recordedAt);
    return (!query || text.includes(query.toLowerCase()))
      && (!fromDate || entryDate >= fromDate)
      && (!toDate || entryDate <= toDate);
  });
  const paged = paginate(filtered, page, 6);

  useEffect(() => {
    setPage(1);
  }, [query, fromDate, toDate]);

  return (
    <section className="workspace-grid drawer-workspace physique-page">
      <div className="workspace-main">
        <section className="hero-panel physique-hero">
          <div>
            <p className="eyebrow">Current physique</p>
            <h3>{latest ? `${latest.weightKg} kg${latest.estimatedBodyFatPercent ? ` · ${latest.estimatedBodyFatPercent}% body fat` : ''}` : 'No body log yet'}</h3>
            <p>{latest?.status || 'Track weight, waist, neck, mood, and status to see body-composition direction.'}</p>
          </div>
          <div className="physique-hero-action">
            <PhysiqueDiagram entry={latest} entries={props.entries} />
            <button onClick={() => {
              setSelected(null);
              setIsCreating(true);
            }}>Log physique</button>
          </div>
        </section>

        <section className="surface">
          <SectionTitle kicker="Composition" title="Body signals" />
          <div className="metric-strip">
            <SummaryPill label="BMI" value={latest?.bmi ?? 'n/a'} />
            <SummaryPill label="Body fat" value={latest?.estimatedBodyFatPercent ? `${latest.estimatedBodyFatPercent}%` : 'n/a'} />
            <SummaryPill label="Lean mass" value={latest?.leanMassKg ? `${latest.leanMassKg}kg` : 'n/a'} />
            <SummaryPill label="FFMI" value={latest?.ffmi ?? 'n/a'} />
          </div>
        </section>

        <PhysiqueAssessment entry={latest} />

        <div className="filter-bar">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search physique entries" />
          <label className="field compact-field"><span>From</span><input type="date" max={toDate || undefined} value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label>
          <label className="field compact-field"><span>To</span><input type="date" min={fromDate || undefined} max={toDateInput(new Date())} value={toDate} onChange={(event) => setToDate(event.target.value)} /></label>
          {(fromDate || toDate) && <button className="secondary-button" onClick={() => { setFromDate(''); setToDate(''); }}>Clear dates</button>}
        </div>

        <div className="review-stack">
          {paged.items.map((entry) => (
            <article className="surface review-card physique-entry" key={entry.id}>
              <SectionTitle kicker={formatDateTime(entry.recordedAt)} title={`${entry.weightKg} kg · mood ${entry.moodScore}/10`} />
              <dl className="review-fields">
                <div><dt>Waist</dt><dd>{entry.waistCm ? `${entry.waistCm} cm` : 'Missing'}</dd></div>
                <div><dt>Neck</dt><dd>{entry.neckCm ? `${entry.neckCm} cm` : 'Missing'}</dd></div>
                <div><dt>Body fat</dt><dd>{entry.estimatedBodyFatPercent ? `${entry.estimatedBodyFatPercent}%` : 'Need waist + neck'}</dd></div>
                <div><dt>Lean mass</dt><dd>{entry.leanMassKg ? `${entry.leanMassKg} kg` : 'n/a'}</dd></div>
              </dl>
              <p>{entry.notes || entry.status || 'No notes.'}</p>
              <div className="card-actions">
                <button className="secondary-button" onClick={() => {
                  setIsCreating(false);
                  setSelected(entry);
                }}>Edit</button>
                <button className="danger-button" onClick={() => confirmDelete('Delete this physique entry?') && props.onDelete(entry.id)}>Delete</button>
              </div>
            </article>
          ))}
          {filtered.length === 0 && <EmptyState text="No physique entries match the current filters." />}
        </div>
        <PaginationControls page={page} totalPages={paged.totalPages} totalItems={filtered.length} onPage={setPage} />
      </div>

      <EditorDrawer open={isCreating || selected !== null} label={selected ? 'Edit physique entry' : 'Log physique'} onClose={() => {
        setSelected(null);
        setIsCreating(false);
      }}>
        <PhysiqueEntryForm
          key={selected?.id ?? `new-physique-${latest?.id ?? 'empty'}`}
          entry={selected}
          baseline={latest ?? null}
          busy={props.busy}
          onSave={(body) => {
            props.onSave(body, selected?.id);
            setSelected(null);
            setIsCreating(false);
          }}
          onCancel={() => {
            setSelected(null);
            setIsCreating(false);
          }}
        />
      </EditorDrawer>
    </section>
  );
}

function PhysiqueAssessment({ entry }: { entry?: PhysiqueEntry }) {
  if (!entry || entry.estimatedBodyFatPercent == null || entry.ffmi == null || entry.waistCm == null) {
    return (
      <section className="surface physique-assessment">
        <SectionTitle kicker="Scientific read" title="Add waist and neck to unlock your assessment" />
        <p className="muted-copy">Axis needs weight, height, waist, and neck measured under consistent conditions. One tape estimate is useful for direction, not diagnosis.</p>
      </section>
    );
  }

  const isMale = entry.sex.toLowerCase().startsWith('m');
  const bodyFat = entry.estimatedBodyFatPercent;
  const ffmi = entry.ffmi;
  const waistToHeight = entry.waistCm / entry.heightCm;
  const lowerLeanMass = ffmi < (isMale ? 16 : 13.2);
  const muscular = ffmi >= (isMale ? 19.5 : 16.5);
  const highAdiposity = bodyFat >= (isMale ? 25 : 35);
  const elevatedAdiposity = bodyFat >= (isMale ? 20 : 30);
  const lean = bodyFat <= (isMale ? 15 : 24);

  let profile = 'Balanced recomposition zone';
  let tone = 'balanced';
  let description = 'Your current estimate sits between a clearly lean and clearly high-adiposity profile. Small improvements in strength and waist trend matter more than chasing a dramatic label.';
  let direction = 'Recomposition';
  let directionCopy = 'Train progressively, keep protein consistent, and hold calories near maintenance while waist and strength reveal the trend.';

  if (highAdiposity && lowerLeanMass) {
    profile = 'Under-muscled, higher-fat pattern';
    tone = 'recomp';
    description = 'This is the closest scientific version of the internet term “skinny fat”: relatively low lean mass together with higher estimated adiposity. It is a body-composition pattern, not a diagnosis or an insult.';
    direction = 'Recomposition first';
    directionCopy = 'Prioritize progressive strength training and high protein. Use only a modest calorie deficit so muscle gain and training quality remain realistic.';
  } else if (highAdiposity && muscular) {
    profile = 'Muscular base, higher adiposity';
    tone = 'cut';
    description = 'Your FFMI suggests a meaningful lean-mass base, while body-fat and waist measures point toward excess adiposity. BMI alone would miss that distinction.';
    direction = 'Controlled cut';
    directionCopy = 'Preserve lifting performance and protein while reducing calories gradually. Judge success using waist plus strength, not scale weight alone.';
  } else if (elevatedAdiposity) {
    profile = muscular ? 'Solid base, softer composition' : 'Recomposition opportunity';
    tone = 'recomp';
    description = muscular
      ? 'You appear to carry useful lean mass with room to reduce fat for more visible definition.'
      : 'The data suggests improving lean mass and reducing waist slowly rather than pursuing an aggressive bulk or crash diet.';
    direction = 'Slow recomp or mild cut';
    directionCopy = 'Aim for repeatable training, adequate protein, and a mild deficit only if the waist trend is not moving.';
  } else if (lean && muscular) {
    profile = 'Lean athletic profile';
    tone = 'athletic';
    description = 'Estimated adiposity is lean while FFMI suggests an above-average lean-mass base. Focus on performance and avoid cutting simply to make an already-low estimate smaller.';
    direction = 'Maintain or lean gain';
    directionCopy = 'Use a small surplus only when strength and body weight have stalled. Keep waist gain slow and deliberate.';
  } else if (lean && lowerLeanMass) {
    profile = 'Lean, build-focused profile';
    tone = 'gain';
    description = 'Adiposity appears low, but estimated lean mass is also relatively low. More dieting is unlikely to create the look you want.';
    direction = 'Lean gain';
    directionCopy = 'Prioritize progressive hypertrophy training and enough food to gain slowly while monitoring waist.';
  }

  const waistSignal = waistToHeight < 0.5 ? 'Below 0.50 screening line' : 'At or above 0.50 screening line';
  const confidence = entry.waistCm && entry.neckCm ? 'Moderate' : 'Low';

  return (
    <section className={`surface physique-assessment ${tone}`}>
      <div className="assessment-heading">
        <div>
          <p className="eyebrow">Scientific read · looks direction</p>
          <h3>{profile}</h3>
          <p>{description}</p>
        </div>
        <div className="assessment-orbit"><strong>{direction}</strong><span>recommended direction</span></div>
      </div>

      <div className="assessment-signal-grid">
        <div><span>Body fat estimate</span><strong>{bodyFat}%</strong><small>Navy tape estimate</small></div>
        <div><span>Lean-mass signal</span><strong>FFMI {ffmi}</strong><small>{muscular ? 'Strong base signal' : lowerLeanMass ? 'Build priority' : 'Typical range'}</small></div>
        <div><span>Waist / height</span><strong>{waistToHeight.toFixed(2)}</strong><small>{waistSignal}</small></div>
        <div><span>Confidence</span><strong>{confidence}</strong><small>Trend beats one reading</small></div>
      </div>

      <div className="physique-guidance-grid">
        <article>
          <span className="tip-index">01</span>
          <div><strong>Your next move</strong><p>{directionCopy}</p></div>
        </article>
        <article>
          <span className="tip-index">02</span>
          <div><strong>Build the aesthetic frame</strong><p>Track progressive work for shoulders, upper back, chest, glutes, and legs. Better proportions come from added muscle and posture, not from endlessly lowering scale weight.</p></div>
        </article>
        <article>
          <span className="tip-index">03</span>
          <div><strong>Measure the signal correctly</strong><p>Use morning body weight as a weekly average. Measure waist and neck at the same landmarks and conditions; react to a 3–4 week trend, not a single noisy day.</p></div>
        </article>
      </div>

      <div className="assessment-evidence">
        <span>Screening, not medical diagnosis. Tape-based body-fat estimates can be wrong for an individual.</span>
        <a href="https://www.cdc.gov/bmi/adult-calculator/bmi-categories.html" target="_blank" rel="noreferrer">CDC BMI context</a>
        <a href="https://pubmed.ncbi.nlm.nih.gov/22106927/" target="_blank" rel="noreferrer">Waist-to-height evidence</a>
        <a href="https://pubmed.ncbi.nlm.nih.gov/42074983/" target="_blank" rel="noreferrer">FFMI reference study</a>
      </div>
    </section>
  );
}

function WikiPageView({ pages }: { pages: WikiPage[] }) {
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const categories = Array.from(new Set(pages.map((page) => page.category).filter(Boolean))).sort();
  const filtered = pages.filter((page) => {
    const text = `${page.title} ${page.summary} ${page.body} ${page.category}`.toLowerCase();
    return (!query || text.includes(query.toLowerCase())) && (!categoryFilter || page.category === categoryFilter);
  });

  return (
    <section className="page-grid">
      <section className="collection-header">
        <div>
          <p className="eyebrow">Operating manual</p>
          <h3>{pages.length} wiki pages</h3>
        </div>
      </section>
      <div className="filter-bar">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search wiki" />
        <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
          <option value="">All categories</option>
          {categories.map((category) => <option key={category} value={category}>{category}</option>)}
        </select>
      </div>
      <div className="wiki-grid">
        {filtered.map((page) => (
          <article className="surface wiki-card" key={page.id}>
            <SectionTitle kicker={page.category} title={page.title} />
            <p className="wiki-summary">{page.summary}</p>
            {page.body.split('\n\n').map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            <div className="source-list">
              {page.sources.map((source) => <a key={source} href={source} target="_blank" rel="noreferrer">{source.replace(/^https?:\/\//, '')}</a>)}
            </div>
          </article>
        ))}
        {filtered.length === 0 && <EmptyState text="No wiki pages match the current filters." />}
      </div>
    </section>
  );
}

function GoalsPage(props: {
  areas: LifeArea[];
  goals: Goal[];
  progress: GoalProgress[];
  activities: Activity[];
  metrics: Metric[];
  busy: boolean;
  onSave: (goal: unknown, id?: string) => void;
  onMilestoneSave: (goalId: string, milestone: unknown, id?: string) => void;
  onMilestoneDelete: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [selected, setSelected] = useState<Goal | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [inspectedGoal, setInspectedGoal] = useState<Goal | null>(null);
  const [selectedMilestone, setSelectedMilestone] = useState<{ goalId: string; milestone: Milestone | null } | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [page, setPage] = useState(1);
  const activeGoals = props.goals.filter((goal) => goal.status === 'Active');
  const milestoneGoal = props.goals.find((goal) => goal.id === selectedMilestone?.goalId) ?? selected;
  const milestoneToDelete = selectedMilestone?.milestone ?? null;
  const filteredGoals = props.goals.filter((goal) => {
    const text = `${goal.title} ${goal.description} ${goal.lifeAreaName}`.toLowerCase();
    return (!query || text.includes(query.toLowerCase()))
      && (!statusFilter || goal.status === statusFilter)
      && (!priorityFilter || goal.priority === priorityFilter);
  });
  const pagedGoals = paginate(filteredGoals, page, defaultPageSize);

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter, priorityFilter]);

  return (
    <section className="page-grid goals-page">
      <div className="workspace-main">
        <section className="collection-header">
          <div>
            <p className="eyebrow">Active pressure</p>
            <h3>{activeGoals.length} active goals</h3>
          </div>
          <button onClick={() => {
            setSelected(null);
            setIsCreating(true);
            setInspectedGoal(null);
            setSelectedMilestone(null);
          }}>New goal</button>
        </section>

        <div className="filter-bar">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search goals" />
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">All statuses</option>
            {goalStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
          <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}>
            <option value="">All priorities</option>
            {goalPriorities.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
          </select>
        </div>

        <div className="entity-grid">
          {pagedGoals.items.map((goal) => {
            const progress = props.progress.find((item) => item.goal.id === goal.id);
            return (
            <article
              className="entity-card goal-card"
              key={goal.id}
              role="button"
              tabIndex={0}
              onClick={() => {
                setInspectedGoal(goal);
                setIsCreating(false);
                setSelected(null);
                setSelectedMilestone(null);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setInspectedGoal(goal);
                  setIsCreating(false);
                  setSelected(null);
                  setSelectedMilestone(null);
                }
              }}
            >
              <div className="entity-card-top">
                <span className="color-chip" style={{ background: goal.lifeAreaColor }}>{goal.lifeAreaName}</span>
                <strong>{goal.priority}</strong>
              </div>
              <h3>{goal.title}</h3>
              <p>{goal.description || 'No description yet.'}</p>
              <div className="goal-card-progress">
                <GoalProgressRing value={progress?.decayedProgress ?? goal.currentValue} color={goal.lifeAreaColor} size="small" label="score" />
                <div>
                  <strong>{progress?.completedDays ?? 0}{progress?.trackingTargetDays ? ` / ${progress.trackingTargetDays} days` : ' tracked days'}</strong>
                  <span>{progress?.completedThisWeek ?? 0}/{goal.maintenanceTargetPerWeek ?? 'flex'} this week</span>
                </div>
              </div>
              <div className="goal-health-row">
                <span className={`status-badge ${getGoalHealth(goal).toLowerCase()}`}>{getGoalHealth(goal)}</span>
                <small>{goal.progressType} · decay {goal.decayRatePercentPerWeek}%/day</small>
              </div>
              <dl className="compact-dl">
                <div><dt>Maintenance</dt><dd>{goal.maintenanceThreshold}%</dd></div>
                <div><dt>Target/week</dt><dd>{goal.maintenanceTargetPerWeek ?? 'None'}</dd></div>
                <div><dt>Target</dt><dd>{goal.targetValue} {goal.unit}</dd></div>
              </dl>
              <div className="milestone-stack">
                {goal.milestones.slice(0, 4).map((milestone) => (
                  <button className="milestone-row" key={milestone.id} onClick={(event) => {
                    event.stopPropagation();
                    setInspectedGoal(null);
                    setIsCreating(false);
                    setSelected(goal);
                    setSelectedMilestone({ goalId: goal.id, milestone });
                  }}>
                    <span>
                      <strong>{milestone.title}</strong>
                      <small>{milestone.status} · {milestone.currentValue}/{milestone.targetValue} {milestone.unit}</small>
                    </span>
                    <em>{milestone.progress}%</em>
                  </button>
                ))}
                {goal.milestones.length === 0 && <p className="muted-copy">No milestones yet.</p>}
              </div>
              <div className="card-actions">
                <button className="secondary-button" onClick={(event) => {
                  event.stopPropagation();
                  setInspectedGoal(null);
                  setIsCreating(false);
                  setSelected(goal);
                  setSelectedMilestone(null);
                }}>Edit</button>
                <button className="secondary-button" onClick={(event) => {
                  event.stopPropagation();
                  setInspectedGoal(null);
                  setIsCreating(false);
                  setSelected(goal);
                  setSelectedMilestone({ goalId: goal.id, milestone: null });
                }}>Milestone</button>
                <button className="danger-button" onClick={(event) => {
                  event.stopPropagation();
                  if (confirmDelete('Delete this goal?')) {
                    props.onDelete(goal.id);
                  }
                }}>Delete</button>
              </div>
            </article>
            );
          })}
        </div>
        <PaginationControls page={page} totalPages={pagedGoals.totalPages} totalItems={filteredGoals.length} onPage={setPage} />
      </div>

      {(inspectedGoal || selected || selectedMilestone || isCreating) && <button className="goal-drawer-backdrop" aria-label="Close goal panel" onClick={() => { setInspectedGoal(null); setSelected(null); setSelectedMilestone(null); setIsCreating(false); }} />}
      {(inspectedGoal || selected || selectedMilestone || isCreating) && <aside className="goals-editor-panel">
        {inspectedGoal && !selected && !selectedMilestone && (
          <GoalInsightPanel
            goal={inspectedGoal}
            activities={props.activities}
            metrics={props.metrics}
            progress={props.progress.find((item) => item.goal.id === inspectedGoal.id)}
            onClose={() => setInspectedGoal(null)}
          />
        )}
        {(selected || isCreating) && <GoalForm
          key={selected?.id ?? 'new-goal'}
          goal={selected}
          areas={props.areas}
          busy={props.busy}
          onSave={(body) => {
            props.onSave(body, selected?.id);
            setSelected(null);
            setIsCreating(false);
            setInspectedGoal(null);
            setSelectedMilestone(null);
          }}
          onCancel={() => {
            setSelected(null);
            setIsCreating(false);
            setSelectedMilestone(null);
          }}
        />}
        {milestoneGoal && (
          <MilestoneForm
            key={`${selectedMilestone?.goalId ?? milestoneGoal.id}-${selectedMilestone?.milestone?.id ?? 'new-milestone'}`}
            goal={milestoneGoal}
            milestone={selectedMilestone?.milestone ?? null}
            busy={props.busy}
            onSave={(body) => {
              props.onMilestoneSave(milestoneGoal.id, body, selectedMilestone?.milestone?.id);
              setSelectedMilestone(null);
            }}
            onDelete={milestoneToDelete ? () => {
              if (confirmDelete('Delete this milestone? Goal progress will be recalculated.')) {
                props.onMilestoneDelete(milestoneToDelete.id);
                setSelectedMilestone(null);
              }
            } : undefined}
            onCancel={() => setSelectedMilestone(null)}
          />
        )}
      </aside>}
    </section>
  );
}

function GoalInsightPanel(props: { goal: Goal; activities: Activity[]; metrics: Metric[]; progress?: GoalProgress; onClose: () => void }) {
  const goalActivities = props.activities.filter((activity) => activity.goalId === props.goal.id);
  const completed = goalActivities.filter((activity) => activity.status === 'Completed');
  const skipped = goalActivities.filter((activity) => activity.status === 'Skipped' || activity.status === 'Cancelled');
  const minutes = completed.reduce((sum, activity) => sum + (isDurationActivity(activity.title) ? activity.durationMinutes : 0), 0);
  const lastDone = completed
    .map((activity) => getActivityDate(activity))
    .filter(Boolean)
    .sort()
    .at(-1);
  const recentDays = Array.from({ length: 30 }, (_, index) => addDays(new Date(), index - 29));
  const goalMetrics = props.metrics.filter((metric) => metric.goalId === props.goal.id);
  const isFlexibleStudyGoal = /dsa|system design/i.test(props.goal.title);
  const weeklyTarget = props.goal.maintenanceTargetPerWeek ?? 0;
  const weekBars = Array.from({ length: 26 }, (_, index) => {
    const end = endOfDay(addDays(new Date(), -(25 - index) * 7));
    const start = startOfDay(addDays(end, -6));
    const count = new Set(completed.filter((activity) => { const value = getActivityDate(activity); return value && new Date(value) >= start && new Date(value) <= end; }).map((activity) => localDateKey(getActivityDate(activity)!))).size;
    return { start, count, percent: Math.min(100, count / Math.max(1, weeklyTarget || count || 1) * 100) };
  });

  return (
    <section className="goal-detail-panel">
      <div className="goal-detail-top">
        <SectionTitle kicker={props.goal.lifeAreaName} title={props.goal.title} />
        <button className="secondary-button icon-button" onClick={props.onClose} aria-label="Close goal details">x</button>
      </div>
      <div className="goal-orbit-grid">
        <GoalProgressRing value={props.progress?.decayedProgress ?? props.goal.currentValue} color={props.goal.lifeAreaColor} label="maintenance" />
        {props.progress?.journeyProgress != null && <GoalProgressRing value={props.progress.journeyProgress} color="#ff4fb3" label="journey" />}
        <div className="goal-progress-copy">
          <span className={props.progress?.maintenanceSatisfied ? 'status-badge strong' : 'status-badge attention'}>{props.progress?.maintenanceSatisfied ? 'Maintenance reached' : 'Building baseline'}</span>
          <h4>{props.progress?.completedDays ?? completed.length}{props.progress?.trackingTargetDays ? ` of ${props.progress.trackingTargetDays} days` : ' completed days'}</h4>
          <p>{props.progress?.completedThisWeek ?? 0} of {props.goal.maintenanceTargetPerWeek ?? 'flexible'} expected this week. Decay is {props.goal.decayRatePercentPerWeek}% per inactive day{props.progress?.decayGraceDays ? ` after a ${props.progress.decayGraceDays}-day grace period` : ''}.</p>
        </div>
      </div>
      <dl className="compact-dl">
        <div><dt>Maintenance score</dt><dd>{props.progress?.decayedProgress ?? props.goal.currentValue}%</dd></div>
        <div><dt>Before decay</dt><dd>{props.progress?.baseProgress ?? props.goal.currentValue}%</dd></div>
        <div><dt>Done</dt><dd>{completed.length}</dd></div>
        <div><dt>Skipped</dt><dd>{skipped.length}</dd></div>
        <div><dt>Minutes</dt><dd>{minutes}</dd></div>
        <div><dt>Last done</dt><dd>{lastDone ? formatShortDate(lastDone) : 'No log'}</dd></div>
        <div><dt>Weekly target</dt><dd>{props.goal.maintenanceTargetPerWeek ?? 'Flexible'}</dd></div>
        <div><dt>Current streak</dt><dd>{props.progress?.currentStreakDays ?? 0} days</dd></div>
        <div><dt>Best streak</dt><dd>{props.progress?.longestStreakDays ?? 0} days</dd></div>
        <div><dt>Started</dt><dd>{props.progress?.firstTrackedAt ? formatShortDate(props.progress.firstTrackedAt) : 'Not yet'}</dd></div>
      </dl>
      <section className="goal-weekly-chart" aria-label="26 week execution history">
        <div className="goal-chart-heading"><div><strong>26-week execution</strong><small>Completed days versus weekly target</small></div><span>Target {weeklyTarget || 'flex'} / week</span></div>
        <div className="goal-week-bars">{weekBars.map((week) => <span key={dateKey(week.start)} title={`${week.start.toLocaleDateString()}: ${week.count} completed days`}><i style={{ height: `${Math.max(4, week.percent)}%`, background: week.count >= weeklyTarget && weeklyTarget > 0 ? 'var(--success)' : props.goal.lifeAreaColor }} /></span>)}</div>
        <div className="goal-chart-axis"><span>26 weeks ago</span><span>Now</span></div>
      </section>
      <div className="track-heatmap goal-history">
        {recentDays.map((day) => {
          const dayActivities = goalActivities.filter((activity) => sameDay(getActivityDate(activity), day));
          const status = getDayStatus(dayActivities, isFlexibleStudyGoal, day);
          return <span key={dateKey(day)} className={status} title={`${day.toLocaleDateString()}: ${status}`} />;
        })}
      </div>
      <div className="goal-detail-stack">
        {goalMetrics.map((metric) => (
          <article className="goal-mini-panel" key={metric.id}>
            <strong>{metric.name}</strong>
            <TargetComparison metric={metric} />
            <p className="muted-copy">
              Latest: {metric.latestEntry ? `${metric.latestEntry.value} ${metric.unit} · ${formatShortDate(metric.latestEntry.recordedAt)}` : 'No entries yet'}
            </p>
          </article>
        ))}
        {goalMetrics.length === 0 && <p className="muted-copy">No linked metrics yet.</p>}
      </div>
      <div className="milestone-stack">
        {props.goal.milestones.map((milestone) => (
          <div className="milestone-row static" key={milestone.id}>
            <span>
              <strong>{milestone.title}</strong>
              <small>{milestone.status} · {milestone.currentValue}/{milestone.targetValue} {milestone.unit}</small>
            </span>
            <em>{milestone.progress}%</em>
          </div>
        ))}
        {props.goal.milestones.length === 0 && <p className="muted-copy">No milestones yet.</p>}
      </div>
    </section>
  );
}

function AreasPage(props: {
  areas: LifeArea[];
  busy: boolean;
  onSave: (area: unknown, id?: string) => void;
  onDelete: (id: string) => void;
}) {
  const [selected, setSelected] = useState<LifeArea | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const filteredAreas = props.areas.filter((area) => {
    const text = `${area.name} ${area.description} ${area.color} ${area.icon}`.toLowerCase();
    const statusMatches = statusFilter === '' || (statusFilter === 'active' ? area.isActive : !area.isActive);
    return (!query || text.includes(query.toLowerCase())) && statusMatches;
  });
  const pagedAreas = paginate(filteredAreas, page, defaultPageSize);

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter]);

  return (
    <section className="workspace-grid drawer-workspace">
      <div className="workspace-main">
        <section className="collection-header">
          <div>
            <p className="eyebrow">Attention architecture</p>
            <h3>{props.areas.length} life areas</h3>
          </div>
          <button onClick={() => {
            setSelected(null);
            setIsCreating(true);
          }}>New life area</button>
        </section>

        <div className="filter-bar">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search life areas" />
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <div className="entity-grid">
          {pagedAreas.items.map((area) => (
            <article className="entity-card area-card" key={area.id}>
              <div className="area-stripe" style={{ background: area.color }} />
              <div className="entity-card-top">
                <strong>{area.name}</strong>
                <span>{area.isActive ? 'Active' : 'Inactive'}</span>
              </div>
              <p>{area.description || 'No description yet.'}</p>
              <dl className="compact-dl">
                <div><dt>Priority</dt><dd>{area.priorityWeight}</dd></div>
                <div><dt>Target</dt><dd>{area.targetScore}</dd></div>
                <div><dt>Color</dt><dd>{area.color}</dd></div>
              </dl>
              <div className="card-actions">
                <button className="secondary-button" onClick={() => {
                  setIsCreating(false);
                  setSelected(area);
                }}>Edit</button>
                <button className="danger-button" onClick={() => confirmDelete('Delete this life area? Linked data may also be removed.') && props.onDelete(area.id)}>Delete</button>
              </div>
            </article>
          ))}
          {filteredAreas.length === 0 && <EmptyState text="No life areas match the current filters." />}
        </div>
        <PaginationControls page={page} totalPages={pagedAreas.totalPages} totalItems={filteredAreas.length} onPage={setPage} />
      </div>

      <EditorDrawer open={isCreating || selected !== null} label={selected ? 'Edit life area' : 'Create life area'} onClose={() => {
        setSelected(null);
        setIsCreating(false);
      }}>
        <LifeAreaForm
          key={selected?.id ?? 'new-area'}
          area={selected}
          busy={props.busy}
          onSave={(body) => {
            props.onSave(body, selected?.id);
            setSelected(null);
            setIsCreating(false);
          }}
          onCancel={() => {
            setSelected(null);
            setIsCreating(false);
          }}
        />
      </EditorDrawer>
    </section>
  );
}

function TemplatesPage(props: {
  areas: LifeArea[];
  templates: ActivityTemplate[];
  rules: RecurrenceRule[];
  busy: boolean;
  onSave: (template: unknown, id?: string) => void;
  onDelete: (id: string) => void;
  onRuleSave: (rule: unknown, id?: string) => void;
  onRuleDelete: (id: string) => void;
  onGenerate: (id: string) => void;
}) {
  const [selected, setSelected] = useState<ActivityTemplate | null>(null);
  const [selectedRule, setSelectedRule] = useState<RecurrenceRule | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [query, setQuery] = useState('');
  const [areaFilter, setAreaFilter] = useState('');
  const [page, setPage] = useState(1);
  const templateForRule = props.templates.find((template) => template.id === selectedRule?.templateId) ?? selected;
  const filteredTemplates = props.templates.filter((template) => {
    const text = `${template.title} ${template.description} ${template.lifeAreaName}`.toLowerCase();
    return (!query || text.includes(query.toLowerCase())) && (!areaFilter || template.lifeAreaId === areaFilter);
  });
  const pagedTemplates = paginate(filteredTemplates, page, defaultPageSize);

  useEffect(() => {
    setPage(1);
  }, [query, areaFilter]);

  return (
    <section className="workspace-grid drawer-workspace">
      <div className="workspace-main">
        <section className="collection-header">
          <div>
            <p className="eyebrow">Reusable planning</p>
            <h3>{props.templates.length} templates</h3>
          </div>
          <button onClick={() => {
            setSelected(null);
            setSelectedRule(null);
            setIsCreating(true);
          }}>New template</button>
        </section>

        <div className="filter-bar">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search templates" />
          <select value={areaFilter} onChange={(event) => setAreaFilter(event.target.value)}>
            <option value="">All areas</option>
            {props.areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
          </select>
        </div>

        <div className="entity-grid">
          {pagedTemplates.items.map((template) => {
            const templateRules = props.rules.filter((rule) => rule.templateId === template.id);

            return (
              <article className="entity-card template-card" key={template.id}>
                <div className="entity-card-top">
                  <span className="color-chip" style={{ background: template.lifeAreaColor }}>{template.lifeAreaName}</span>
                  <strong>{template.isActive ? 'Active' : 'Inactive'}</strong>
                </div>
                <h3>{template.title}</h3>
                <p>{template.description || 'No description yet.'}</p>
                <dl className="compact-dl">
                  <div><dt>Minutes</dt><dd>{template.defaultDurationMinutes}</dd></div>
                  <div><dt>Energy</dt><dd>{template.energyCost}</dd></div>
                  <div><dt>Points</dt><dd>{template.defaultPoints}</dd></div>
                </dl>
                <div className="recurrence-list">
                  {templateRules.map((rule) => (
                    <div className="recurrence-row" key={rule.id}>
                      <button onClick={() => {
                        setIsCreating(false);
                        setSelected(template);
                        setSelectedRule(rule);
                      }}>
                        <strong>{formatRecurrence(rule)}</strong>
                        <span>{rule.startDate}{rule.endDate ? ` to ${rule.endDate}` : ''}</span>
                      </button>
                      <button className="secondary-button" disabled={props.busy} onClick={() => props.onGenerate(rule.id)}>Generate</button>
                    </div>
                  ))}
                  {templateRules.length === 0 && <p className="muted-copy">No recurrence rule yet.</p>}
                </div>
                <div className="card-actions">
                  <button className="secondary-button" onClick={() => {
                    setIsCreating(false);
                    setSelected(template);
                    setSelectedRule(null);
                  }}>Edit</button>
                  <button className="secondary-button" onClick={() => {
                    setIsCreating(false);
                    setSelected(template);
                    setSelectedRule(null);
                  }}>Add recurrence</button>
                  <button className="danger-button" onClick={() => confirmDelete('Delete this template? Existing activities will stay, but links may be removed.') && props.onDelete(template.id)}>Delete</button>
                </div>
              </article>
            );
          })}
          {filteredTemplates.length === 0 && <EmptyState text="No templates match the current filters." />}
        </div>
        <PaginationControls page={page} totalPages={pagedTemplates.totalPages} totalItems={filteredTemplates.length} onPage={setPage} />
      </div>

      <EditorDrawer open={isCreating || selected !== null || selectedRule !== null} label={selectedRule ? 'Edit recurrence' : selected ? 'Edit template' : 'Create template'} onClose={() => {
        setSelected(null);
        setSelectedRule(null);
        setIsCreating(false);
      }}>
        <TemplateForm
          key={selected?.id ?? 'new-template'}
          template={selected}
          areas={props.areas}
          busy={props.busy}
          onSave={(body) => {
            props.onSave(body, selected?.id);
            setSelected(null);
            setSelectedRule(null);
            setIsCreating(false);
          }}
          onCancel={() => {
            setSelected(null);
            setSelectedRule(null);
            setIsCreating(false);
          }}
        />
        {templateForRule && (
          <RecurrenceRuleForm
            key={`${templateForRule.id}-${selectedRule?.id ?? 'new-rule'}`}
            template={templateForRule}
            rule={selectedRule}
            busy={props.busy}
            onSave={(body) => {
              props.onRuleSave(body, selectedRule?.id);
              setSelectedRule(null);
              setSelected(null);
            }}
            onDelete={selectedRule ? () => {
              if (confirmDelete('Delete this recurrence rule?')) {
                props.onRuleDelete(selectedRule.id);
                setSelectedRule(null);
              }
            } : undefined}
            onCancel={() => {
              setSelectedRule(null);
              setSelected(null);
            }}
          />
        )}
      </EditorDrawer>
    </section>
  );
}

function MetricsPage(props: {
  areas: LifeArea[];
  goals: Goal[];
  metrics: Metric[];
  busy: boolean;
  onSave: (metric: unknown, id?: string) => void;
  onEntry: (id: string, body: unknown) => Promise<void> | void;
  onEntryDelete: (metricId: string, entryId: string) => Promise<void> | void;
  onDelete: (id: string) => void;
}) {
  const [selected, setSelected] = useState<Metric | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [historyMetric, setHistoryMetric] = useState<Metric | null>(null);
  const [historyRange, setHistoryRange] = useState('30');
  const [query, setQuery] = useState('');
  const [areaFilter, setAreaFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [historyEntries, setHistoryEntries] = useState<MetricEntry[]>([]);
  const [historyError, setHistoryError] = useState('');
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [entryValues, setEntryValues] = useState<Record<string, string>>({});
  const [entryNotes, setEntryNotes] = useState<Record<string, string>>({});
  const [entryTimes, setEntryTimes] = useState<Record<string, string>>({});
  const [metricPreviews, setMetricPreviews] = useState<Record<string, MetricEntry[]>>({});

  useEffect(() => {
    if (!historyMetric) {
      setHistoryEntries([]);
      return;
    }

    void loadMetricHistory(historyMetric.id, historyRange);
  }, [historyMetric, historyRange]);

  async function loadMetricHistory(metricId: string, range: string) {
    setIsHistoryLoading(true);
    setHistoryError('');
    try {
      const params = new URLSearchParams();
      if (range !== 'all') {
        const from = new Date();
        from.setDate(from.getDate() - Number(range));
        params.set('from', from.toISOString());
      }

      const suffix = params.toString() ? `?${params}` : '';
      setHistoryEntries(await api.get<MetricEntry[]>(`/api/metrics/${metricId}/entries${suffix}`));
    } catch (error) {
      setHistoryError(readError(error, 'Could not load metric history.'));
    } finally {
      setIsHistoryLoading(false);
    }
  }

  async function logEntry(metric: Metric) {
    const value = entryValues[metric.id];
    if (value === undefined || value.trim() === '') {
      return;
    }

    await props.onEntry(metric.id, {
      value: Number(value),
      recordedAt: new Date(entryTimes[metric.id] ?? Date.now()).toISOString(),
      notes: entryNotes[metric.id] ?? ''
    });
    setEntryValues({ ...entryValues, [metric.id]: '' });
    setEntryNotes({ ...entryNotes, [metric.id]: '' });
    setEntryTimes({ ...entryTimes, [metric.id]: toLocalInput(new Date()) });
    if (historyMetric?.id === metric.id) {
      await loadMetricHistory(metric.id, historyRange);
    }
  }

  async function deleteEntry(entry: MetricEntry) {
    if (!historyMetric || !confirmDelete('Delete this metric entry?')) {
      return;
    }

    await props.onEntryDelete(historyMetric.id, entry.id);
    await loadMetricHistory(historyMetric.id, historyRange);
  }

  const filteredMetrics = props.metrics.filter((metric) => {
    const areaName = props.areas.find((area) => area.id === metric.lifeAreaId)?.name ?? '';
    const text = `${metric.name} ${metric.unit} ${areaName}`.toLowerCase();
    return (!query || text.includes(query.toLowerCase()))
      && (!areaFilter || metric.lifeAreaId === areaFilter)
      && (!typeFilter || metric.valueType === typeFilter);
  });
  const pagedMetrics = paginate(filteredMetrics, page, defaultPageSize);

  useEffect(() => {
    const from = new Date();
    from.setDate(from.getDate() - 30);
    void Promise.all(pagedMetrics.items.map(async (metric) => {
      const entries = await api.get<MetricEntry[]>(`/api/metrics/${metric.id}/entries?from=${encodeURIComponent(from.toISOString())}`);
      return [metric.id, Array.isArray(entries) ? entries.slice(0, 36) : []] as const;
    })).then((rows) => setMetricPreviews((current) => ({ ...current, ...Object.fromEntries(rows) }))).catch(() => undefined);
  }, [page, query, areaFilter, typeFilter, props.metrics]);

  useEffect(() => {
    setPage(1);
  }, [query, areaFilter, typeFilter]);

  return (
    <section className="workspace-grid drawer-workspace metrics-page">
      <div className="workspace-main">
        <section className="collection-header">
          <div>
            <p className="eyebrow">Measured signals</p>
            <h3>{props.metrics.length} metrics</h3>
          </div>
          <button onClick={() => {
            setSelected(null);
            setHistoryMetric(null);
            setIsCreating(true);
          }}>New metric</button>
        </section>

        <div className="filter-bar">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search metrics" />
          <select value={areaFilter} onChange={(event) => setAreaFilter(event.target.value)}>
            <option value="">All areas</option>
            {props.areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
          </select>
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
            <option value="">All types</option>
            {metricTypes.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </div>

        <div className="entity-grid metrics-grid">
          {pagedMetrics.items.map((metric) => (
            <article className="entity-card" key={metric.id}>
              <div className="entity-card-top">
                <strong>{metric.name}</strong>
                <span>{metric.valueType}</span>
              </div>
              <p className="large-value">{metric.latestEntry ? formatMetricValue(metric, metric.latestEntry.value) : 'No entries'}</p>
              <MetricSparkline entries={metricPreviews[metric.id] ?? (metric.latestEntry ? [metric.latestEntry] : [])} metric={metric} />
              <TargetComparison metric={metric} />
              {metric.latestEntry?.notes && <p className="metric-latest-note"><strong>Latest note</strong>{metric.latestEntry.notes}</p>}
              <form className="mini-form metric-log-form" onSubmit={(event) => {
                event.preventDefault();
                void logEntry(metric);
              }}>
                {metric.valueType === 'Boolean'
                  ? <select className="metric-value-input" aria-label={`${metric.name} result`} value={entryValues[metric.id] ?? ''} onChange={(event) => setEntryValues({ ...entryValues, [metric.id]: event.target.value })}><option value="">Result</option><option value="1">Yes</option><option value="0">No</option></select>
                  : <input className="metric-value-input" type="number" value={entryValues[metric.id] ?? ''} onChange={(event) => setEntryValues({ ...entryValues, [metric.id]: event.target.value })} placeholder="Value" />}
                <input className="metric-time-input" aria-label={`${metric.name} recorded at`} type="datetime-local" max={toLocalInput(new Date())} value={entryTimes[metric.id] ?? toLocalInput(new Date())} onChange={(event) => setEntryTimes({ ...entryTimes, [metric.id]: event.target.value })} />
                <input className="metric-note-input" value={entryNotes[metric.id] ?? ''} onChange={(event) => setEntryNotes({ ...entryNotes, [metric.id]: event.target.value })} placeholder="Note" />
                <button type="submit" disabled={props.busy}>Log</button>
              </form>
              <div className="card-actions">
                <button className="secondary-button" onClick={() => {
                  setSelected(null);
                  setIsCreating(false);
                  setHistoryMetric(metric);
                }}>History</button>
                <button className="secondary-button" onClick={() => {
                  setHistoryMetric(null);
                  setIsCreating(false);
                  setSelected(metric);
                }}>Edit</button>
                <button className="danger-button" onClick={() => confirmDelete('Delete this metric?') && props.onDelete(metric.id)}>Delete</button>
              </div>
            </article>
          ))}
        </div>
        <PaginationControls page={page} totalPages={pagedMetrics.totalPages} totalItems={filteredMetrics.length} onPage={setPage} />
      </div>

      <EditorDrawer
        open={isCreating || selected !== null || historyMetric !== null}
        label={historyMetric ? `${historyMetric.name} history` : selected ? 'Edit metric' : 'Create metric'}
        onClose={() => {
          setSelected(null);
          setHistoryMetric(null);
          setIsCreating(false);
        }}
      >
        {historyMetric && (
          <MetricHistoryPanel
            metric={historyMetric}
            entries={historyEntries}
            range={historyRange}
            isLoading={isHistoryLoading}
            error={historyError}
            onRangeChange={setHistoryRange}
            onDeleteEntry={(entry) => void deleteEntry(entry)}
            onClose={() => setHistoryMetric(null)}
          />
        )}
        {!historyMetric && <MetricForm
          key={selected?.id ?? 'new-metric'}
          metric={selected}
          areas={props.areas}
          goals={props.goals}
          busy={props.busy}
          onSave={(body) => {
            props.onSave(body, selected?.id);
            setSelected(null);
            setIsCreating(false);
          }}
          onCancel={() => {
            setSelected(null);
            setIsCreating(false);
          }}
        />}
      </EditorDrawer>
    </section>
  );
}

function MetricHistoryPanel(props: {
  metric: Metric;
  entries: MetricEntry[];
  range: string;
  isLoading: boolean;
  error: string;
  onRangeChange: (range: string) => void;
  onDeleteEntry: (entry: MetricEntry) => void;
  onClose: () => void;
}) {
  const [page, setPage] = useState(1);
  const sorted = [...props.entries].sort((first, second) => new Date(first.recordedAt).getTime() - new Date(second.recordedAt).getTime());
  const latest = sorted.at(-1);
  const previous = sorted.at(-2);
  const delta = latest && previous ? latest.value - previous.value : null;
  const average = sorted.length ? sorted.reduce((sum, entry) => sum + entry.value, 0) / sorted.length : null;
  const newestFirst = [...props.entries].sort((first, second) => new Date(second.recordedAt).getTime() - new Date(first.recordedAt).getTime());
  const pagedEntries = paginate(newestFirst, page, 12);

  useEffect(() => setPage(1), [props.range, props.metric.id]);

  return (
    <EditorShell title={`${props.metric.name} history`} onCancel={props.onClose}>
      <div className="metric-history">
        <div className="button-row">
          {[
            { value: '30', label: '30d' },
            { value: '90', label: '90d' },
            { value: '365', label: '1y' },
            { value: 'all', label: 'All' }
          ].map((option) => (
            <button type="button" className={props.range === option.value ? '' : 'secondary-button'} key={option.value} onClick={() => props.onRangeChange(option.value)}>
              {option.label}
            </button>
          ))}
        </div>

        <MetricSparkline entries={sorted} metric={props.metric} large />

        <dl className="compact-dl">
          <div><dt>Latest</dt><dd>{latest ? formatMetricValue(props.metric, latest.value) : 'None'}</dd></div>
          {props.metric.valueType === 'Boolean'
            ? <><div><dt>Yes</dt><dd>{sorted.filter((entry) => entry.value >= .5).length}</dd></div><div><dt>Success rate</dt><dd>{sorted.length ? `${Math.round(sorted.filter((entry) => entry.value >= .5).length / sorted.length * 100)}%` : 'None'}</dd></div></>
            : <><div><dt>Delta</dt><dd>{delta === null ? 'None' : `${delta > 0 ? '+' : ''}${roundNumber(delta)} ${props.metric.unit}`}</dd></div><div><dt>Average</dt><dd>{average === null ? 'None' : `${roundNumber(average)} ${props.metric.unit}`}</dd></div></>}
        </dl>

        {props.isLoading && <EmptyState text="Loading metric history..." />}
        {props.error && <div className="notice error">{props.error}</div>}

        <div className="metric-entry-table">
          {pagedEntries.items.map((entry) => (
            <div className="metric-entry-row" key={entry.id}>
              <div>
                <strong>{formatMetricValue(props.metric, entry.value)}</strong>
                <span>{formatDateTime(entry.recordedAt)}</span>
                {entry.notes && <p>{entry.notes}</p>}
              </div>
              <button className="danger-button" onClick={() => props.onDeleteEntry(entry)}>Delete</button>
            </div>
          ))}
          {!props.isLoading && props.entries.length === 0 && <EmptyState text="No entries in this range yet." />}
        </div>
        <PaginationControls page={page} totalPages={pagedEntries.totalPages} totalItems={props.entries.length} onPage={setPage} />
      </div>
    </EditorShell>
  );
}

function formatMetricValue(metric: Metric, value: number) {
  if (metric.valueType === 'Boolean') return value >= .5 ? 'Yes' : 'No';
  return `${roundNumber(value)}${metric.unit ? ` ${metric.unit}` : ''}`;
}

function MetricSparkline(props: { entries: MetricEntry[]; metric: Metric; large?: boolean }) {
  const sorted = [...props.entries].sort((first, second) => new Date(first.recordedAt).getTime() - new Date(second.recordedAt).getTime());
  const values = sorted.map((entry) => entry.value);
  const domain = props.metric.targetValue == null ? values : [...values, props.metric.targetValue];
  const min = domain.length ? Math.min(...domain) : 0;
  const max = domain.length ? Math.max(...domain) : 1;
  const y = (value: number) => min === max ? 36 : 60 - (value - min) / (max - min) * 48;
  const x = (index: number) => sorted.length <= 1 ? 110 : index / (sorted.length - 1) * 220;
  const path = sorted.length < 2 ? '' : sorted.map((entry, index) => `${index ? 'L' : 'M'} ${roundNumber(x(index))} ${roundNumber(y(entry.value))}`).join(' ');
  const targetY = props.metric.targetValue == null ? null : y(props.metric.targetValue);
  const yesCount = values.filter((value) => value >= .5).length;
  const latest = sorted.at(-1);
  const previous = sorted.at(-2);
  const delta = latest && previous ? latest.value - previous.value : null;

  return (
    <div className={props.large ? 'metric-chart large professional-chart' : 'metric-chart professional-chart'}>
      <div className="metric-chart-head"><span>Current</span><strong>{latest ? formatMetricValue(props.metric, latest.value) : 'No data'}</strong>{delta !== null && props.metric.valueType !== 'Boolean' && <em>{delta >= 0 ? '+' : ''}{roundNumber(delta)}{props.metric.unit ? ` ${props.metric.unit}` : ''}</em>}</div>
      <div className="metric-plot-shell">
        <div className="metric-y-axis"><span>{roundNumber(max)}</span><span>{roundNumber((max + min) / 2)}</span><span>{roundNumber(min)}</span></div>
        <div className="metric-plot"><span className="plot-unit">{props.metric.unit || (props.metric.valueType === 'Boolean' ? 'yes / no' : 'value')}</span><svg viewBox="0 0 220 72" preserveAspectRatio="none" role="img" aria-label={`${props.metric.name} trend in ${props.metric.unit || 'units'}`}>
          <line x1="0" x2="220" y1="12" y2="12" className="chart-grid" /><line x1="0" x2="220" y1="36" y2="36" className="chart-grid" /><line x1="0" x2="220" y1="60" y2="60" className="chart-grid" />
          {targetY !== null && <line x1="0" x2="220" y1={targetY} y2={targetY} className="sparkline-target" />}
          {path ? <path d={path} /> : <line x1="0" x2="220" y1="58" y2="58" className="sparkline-empty" />}
          {sorted.map((entry, index) => <circle key={entry.id} cx={x(index)} cy={y(entry.value)} r={props.large ? 2.4 : 2}><title>{formatDateTime(entry.recordedAt)}: {formatMetricValue(props.metric, entry.value)}{entry.notes ? ` · ${entry.notes}` : ''}</title></circle>)}
        </svg></div>
      </div>
      <div className="metric-chart-range"><span>{sorted[0] ? formatShortDate(sorted[0].recordedAt) : 'No data'}</span>{props.metric.targetValue != null && <span>Target {formatMetricValue(props.metric, props.metric.targetValue)}</span>}<span>{latest ? formatShortDate(latest.recordedAt) : ''}</span></div>
      {values.length > 0 && (props.metric.valueType === 'Boolean'
        ? <div className="metric-chart-stats"><span>{yesCount} yes</span><span>{values.length} logs</span><span>{Math.round(yesCount / values.length * 100)}% success</span></div>
        : <div className="metric-chart-stats"><span>Low {formatMetricValue(props.metric, Math.min(...values))}</span><span>{values.length} logs</span><span>High {formatMetricValue(props.metric, Math.max(...values))}</span></div>)}
    </div>
  );
}

function TargetComparison({ metric }: { metric: Metric }) {
  if (metric.valueType === 'Boolean') {
    return <p className="muted-copy">Latest check-in: {metric.latestEntry ? formatMetricValue(metric, metric.latestEntry.value) : 'None'}</p>;
  }

  if (metric.targetValue == null || metric.latestEntry == null) {
    return <p className="muted-copy">No target comparison yet.</p>;
  }

  const percent = Math.max(0, Math.min(100, metric.targetValue === 0 ? 0 : metric.latestEntry.value / metric.targetValue * 100));

  return (
    <div className="target-comparison">
      <div className="meter"><i style={{ width: `${percent}%` }} /></div>
      <span>{roundNumber(percent)}% of target {metric.targetValue} {metric.unit}</span>
    </div>
  );
}

function ReviewsPage(props: { reviews: Review[]; activities: Activity[]; goals: Goal[]; busy: boolean; onGenerate: () => void; onGenerateMonthly: () => void; onSave: (id: string, body: unknown) => void; onDelete: (id: string) => void }) {
  const [selected, setSelected] = useState<Review | null>(null);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const filteredReviews = props.reviews.filter((review) => {
    const text = `${review.summary} ${review.whatWorked} ${review.whatDidNotWork} ${review.nextFocus}`.toLowerCase();
    return (!query || text.includes(query.toLowerCase())) && (!typeFilter || review.type === typeFilter);
  });
  const pagedReviews = paginate(filteredReviews, page, 8);

  useEffect(() => {
    setPage(1);
  }, [query, typeFilter]);

  return (
    <section className="workspace-grid drawer-workspace">
      <div className="workspace-main">
        <section className="collection-header">
          <div>
            <p className="eyebrow">Weekly loop</p>
            <h3>Reviews</h3>
          </div>
          <div className="button-row">
            <button className="secondary-button" onClick={props.onGenerateMonthly} disabled={props.busy}>Generate monthly</button>
            <button onClick={props.onGenerate} disabled={props.busy}>Generate weekly</button>
          </div>
        </section>

        <ReviewPlanningPanel reviews={props.reviews} activities={props.activities} goals={props.goals} />

        <div className="filter-bar">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search reviews" />
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
            <option value="">All review types</option>
            <option value="Weekly">Weekly</option>
            <option value="Monthly">Monthly</option>
          </select>
        </div>

        <div className="review-stack">
          {pagedReviews.items.map((review) => (
            <article className="surface review-card" key={review.id}>
              <SectionTitle kicker={`${review.periodStart} to ${review.periodEnd}`} title={review.type} />
              <p>{review.summary}</p>
              <dl className="review-fields">
                <div><dt>Worked</dt><dd>{review.whatWorked || 'Not captured yet.'}</dd></div>
                <div><dt>Needs change</dt><dd>{review.whatDidNotWork || 'Not captured yet.'}</dd></div>
                <div><dt>Next focus</dt><dd>{review.nextFocus || 'Not selected yet.'}</dd></div>
              </dl>
              {review.insights.map((insight) => <p className="insight" key={insight.id}>{insight.message}</p>)}
              <div className="card-actions">
                <button className="secondary-button" onClick={() => setSelected(review)}>Edit reflection</button>
                <button className="danger-button" onClick={() => confirmDelete('Delete this review?') && props.onDelete(review.id)}>Delete</button>
              </div>
            </article>
          ))}
          {filteredReviews.length === 0 && <EmptyState text="No reviews match the current filters." />}
        </div>
        <PaginationControls page={page} totalPages={pagedReviews.totalPages} totalItems={filteredReviews.length} onPage={setPage} />
      </div>

      <EditorDrawer open={selected !== null} label="Edit review" onClose={() => setSelected(null)}>
        <ReviewForm
          key={selected?.id ?? 'new-review-placeholder'}
          review={selected}
          busy={props.busy}
          onSave={(body) => {
            if (selected) {
              props.onSave(selected.id, body);
              setSelected(null);
            }
          }}
          onCancel={() => setSelected(null)}
        />
      </EditorDrawer>
    </section>
  );
}

function ReviewForm(props: { review: Review | null; busy: boolean; onSave: (body: unknown) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState({
    summary: props.review?.summary ?? '',
    whatWorked: props.review?.whatWorked ?? '',
    whatDidNotWork: props.review?.whatDidNotWork ?? '',
    nextFocus: props.review?.nextFocus ?? ''
  });

  if (!props.review) {
    return (
      <EditorShell title="Review reflection" onCancel={props.onCancel}>
        <EmptyState text="Select a review to edit its reflection fields." />
      </EditorShell>
    );
  }

  return (
    <EditorShell title="Edit review" onCancel={props.onCancel}>
      <form className="editor-form" onSubmit={(event) => {
        event.preventDefault();
        props.onSave(draft);
      }}>
        <p className="muted-copy">{props.review.periodStart} to {props.review.periodEnd}</p>
        <TextArea label="Summary" value={draft.summary} onChange={(summary) => setDraft({ ...draft, summary })} />
        <TextArea label="What worked?" value={draft.whatWorked} onChange={(whatWorked) => setDraft({ ...draft, whatWorked })} />
        <TextArea label="What did not work?" value={draft.whatDidNotWork} onChange={(whatDidNotWork) => setDraft({ ...draft, whatDidNotWork })} />
        <TextArea label="Main focus next week" value={draft.nextFocus} onChange={(nextFocus) => setDraft({ ...draft, nextFocus })} />
        <button disabled={props.busy}>Save review</button>
      </form>
    </EditorShell>
  );
}

function BackupPage({ onReload }: { onReload: () => Promise<void> }) {
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validation, setValidation] = useState<BackupValidation | null>(null);
  const [importResult, setImportResult] = useState<BackupImportResult | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function loadStatus() {
    setStatus(await api.get<BackupStatus>('/api/backup/status'));
  }

  useEffect(() => {
    void loadStatus().catch((requestError) => setError(readError(requestError, 'Unable to load backup status.')));
  }, []);

  async function handleExport() {
    setBusy(true);
    try {
      setError('');
      const backup = await api.exportBackup();
      const url = URL.createObjectURL(backup.blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = backup.fileName;
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage(`Backup downloaded: ${backup.fileName}`);
      await loadStatus();
    } catch (requestError) {
      setError(readError(requestError, 'Unable to export backup.'));
    } finally {
      setBusy(false);
    }
  }

  async function handleValidate() {
    if (!selectedFile) {
      setError('Choose a backup file first.');
      return;
    }

    setBusy(true);
    try {
      setError('');
      setValidation(await api.validateBackup<BackupValidation>(selectedFile));
    } catch (requestError) {
      setError(readError(requestError, 'Backup validation failed.'));
    } finally {
      setBusy(false);
    }
  }

  async function handleImport() {
    if (!selectedFile) {
      setError('Choose a backup file first.');
      return;
    }

    if (!window.confirm('Import this backup and replace the current Axis database?')) {
      return;
    }

    setBusy(true);
    try {
      setError('');
      const result = await api.importBackup<BackupImportResult>(selectedFile);
      setImportResult(result);
      setValidation(result.validation);
      setMessage(result.message);
      await loadStatus();
      await onReload();
    } catch (requestError) {
      setError(readError(requestError, 'Unable to import backup.'));
    } finally {
      setBusy(false);
    }
  }

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    setSelectedFile(event.target.files?.[0] ?? null);
    setValidation(null);
    setImportResult(null);
    setError('');
    setMessage('');
  }

  return (
    <section className="page-grid">
      {(error || message) && <div className={error ? 'notice error' : 'notice'}>{error || message}</div>}
      <section className="surface">
        <SectionTitle kicker="Persistence" title="SQLite storage" />
        <dl className="status-list">
          <div><dt>Database</dt><dd>{status?.databasePath ?? 'Loading...'}</dd></div>
          <div><dt>Backup directory</dt><dd>{status?.backupDirectory ?? 'Loading...'}</dd></div>
          <div><dt>Status</dt><dd>{status?.databaseExists ? 'Ready' : 'Missing'}</dd></div>
        </dl>
      </section>

      <section className="work-grid two">
        <article className="surface">
          <SectionTitle kicker="Export" title="Download backup" />
          <p>Creates a ZIP archive with manifest.json and axis.db.</p>
          <button onClick={handleExport} disabled={busy}>Export backup</button>
        </article>

        <article className="surface">
          <SectionTitle kicker="Import" title="Restore backup" />
          <label className="field full">
            <span>Backup file</span>
            <input type="file" accept=".zip,application/zip" onChange={handleFile} />
          </label>
          <div className="button-row">
            <button className="secondary-button" onClick={handleValidate} disabled={busy || !selectedFile}>Validate backup</button>
            <button className="danger-button" onClick={handleImport} disabled={busy || !selectedFile}>Import backup</button>
          </div>
          {validation && <ValidationBox validation={validation} />}
          {importResult && <ValidationBox validation={importResult.validation} title={importResult.imported ? 'Import completed' : 'Import blocked'} detail={importResult.preImportBackupFileName ? `Pre-import backup: ${importResult.preImportBackupFileName}` : undefined} />}
        </article>
      </section>
    </section>
  );
}

function LifeAreaForm(props: { area: LifeArea | null; busy: boolean; onSave: (body: unknown) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState({
    name: props.area?.name ?? '',
    description: props.area?.description ?? '',
    color: props.area?.color ?? '#3b82f6',
    icon: props.area?.icon ?? 'circle',
    priorityWeight: props.area?.priorityWeight ?? 10,
    currentScore: props.area?.currentScore ?? 0,
    targetScore: props.area?.targetScore ?? 70,
    isActive: props.area?.isActive ?? true
  });

  return (
    <EditorShell title={props.area ? 'Edit life area' : 'Create life area'} onCancel={props.onCancel}>
      <form className="editor-form" onSubmit={(event) => { event.preventDefault(); props.onSave(draft); }}>
        <TextField label="Name" value={draft.name} onChange={(name) => setDraft({ ...draft, name })} required />
        <TextArea label="Description" value={draft.description} onChange={(description) => setDraft({ ...draft, description })} />
        <div className="form-grid two">
          <label className="field">
            <span>Hex color</span>
            <input value={draft.color} onChange={(event) => setDraft({ ...draft, color: event.target.value })} pattern="^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$" />
          </label>
          <label className="field">
            <span>Color picker</span>
            <input type="color" value={isHexColor(draft.color) ? draft.color : '#3b82f6'} onChange={(event) => setDraft({ ...draft, color: event.target.value })} />
          </label>
        </div>
        <div className="form-grid three">
          <NumberField label="Priority weight" value={draft.priorityWeight} onChange={(priorityWeight) => setDraft({ ...draft, priorityWeight })} />
          <NumberField label="Current score" value={draft.currentScore} onChange={(currentScore) => setDraft({ ...draft, currentScore })} />
          <NumberField label="Target score" value={draft.targetScore} onChange={(targetScore) => setDraft({ ...draft, targetScore })} />
        </div>
        <label className="check-field"><input type="checkbox" checked={draft.isActive} onChange={(event) => setDraft({ ...draft, isActive: event.target.checked })} /> Active</label>
        <button disabled={props.busy}>{props.area ? 'Save changes' : 'Create area'}</button>
      </form>
    </EditorShell>
  );
}

function GoalForm(props: { goal: Goal | null; areas: LifeArea[]; busy: boolean; onSave: (body: unknown) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState({
    lifeAreaId: props.goal?.lifeAreaId ?? props.areas[0]?.id ?? '',
    title: props.goal?.title ?? '',
    description: props.goal?.description ?? '',
    status: props.goal?.status ?? 'Active' as GoalStatus,
    priority: props.goal?.priority ?? 'Secondary' as GoalPriority,
    progressType: props.goal?.progressType ?? 'MilestoneBased' as ProgressType,
    currentValue: props.goal?.currentValue ?? 0,
    targetValue: props.goal?.targetValue ?? 100,
    unit: props.goal?.unit ?? '%',
    targetDate: props.goal?.targetDate ?? '',
    maintenanceThreshold: props.goal?.maintenanceThreshold ?? 80,
    maintenanceTargetPerWeek: props.goal?.maintenanceTargetPerWeek ?? '',
    decayRatePercentPerWeek: props.goal?.decayRatePercentPerWeek ?? 0
  });

  return (
    <EditorShell title={props.goal ? 'Edit goal' : 'Create goal'} onCancel={props.onCancel}>
      <form className="editor-form" onSubmit={(event) => {
        event.preventDefault();
        props.onSave({
          ...draft,
          targetDate: draft.targetDate || null,
          maintenanceTargetPerWeek: draft.maintenanceTargetPerWeek === '' ? null : Number(draft.maintenanceTargetPerWeek)
        });
      }}>
        <TextField label="Title" value={draft.title} onChange={(title) => setDraft({ ...draft, title })} required />
        <TextArea label="Description" value={draft.description} onChange={(description) => setDraft({ ...draft, description })} />
        <SelectField label="Life area" value={draft.lifeAreaId} onChange={(lifeAreaId) => setDraft({ ...draft, lifeAreaId })} options={props.areas.map((area) => ({ value: area.id, label: area.name }))} />
        <div className="form-grid two">
          <SelectField label="Priority" value={draft.priority} onChange={(priority) => setDraft({ ...draft, priority: priority as GoalPriority })} options={goalPriorities.map(toOption)} />
          <SelectField label="Status" value={draft.status} onChange={(status) => setDraft({ ...draft, status: status as GoalStatus })} options={goalStatuses.map(toOption)} />
        </div>
        <SelectField label="Progress type" value={draft.progressType} onChange={(progressType) => setDraft({ ...draft, progressType: progressType as ProgressType })} options={progressTypes.map(toOption)} />
        <div className="form-grid three">
          <NumberField label="Current" value={draft.currentValue} onChange={(currentValue) => setDraft({ ...draft, currentValue })} />
          <NumberField label="Target" value={draft.targetValue} onChange={(targetValue) => setDraft({ ...draft, targetValue })} />
          <TextField label="Unit" value={draft.unit} onChange={(unit) => setDraft({ ...draft, unit })} />
        </div>
        <div className="form-grid three">
          <NumberField label="Maintenance %" value={draft.maintenanceThreshold} onChange={(maintenanceThreshold) => setDraft({ ...draft, maintenanceThreshold })} />
          <NumberOrBlankField label="Target/week" value={draft.maintenanceTargetPerWeek} onChange={(maintenanceTargetPerWeek) => setDraft({ ...draft, maintenanceTargetPerWeek })} />
          <NumberField label="Decay %/day" value={draft.decayRatePercentPerWeek} onChange={(decayRatePercentPerWeek) => setDraft({ ...draft, decayRatePercentPerWeek })} />
        </div>
        <label className="field"><span>Target date</span><input type="date" value={draft.targetDate ?? ''} onChange={(event) => setDraft({ ...draft, targetDate: event.target.value })} /></label>
        <button disabled={props.busy}>{props.goal ? 'Save changes' : 'Create goal'}</button>
      </form>
    </EditorShell>
  );
}

function MilestoneForm(props: { goal: Goal; milestone: Milestone | null; busy: boolean; onSave: (body: unknown) => void; onDelete?: () => void; onCancel: () => void }) {
  const [draft, setDraft] = useState({
    title: props.milestone?.title ?? '',
    description: props.milestone?.description ?? '',
    type: props.milestone?.type ?? 'Count' as MilestoneType,
    currentValue: props.milestone?.currentValue ?? 0,
    targetValue: props.milestone?.targetValue ?? 1,
    unit: props.milestone?.unit ?? '',
    sortOrder: props.milestone?.sortOrder ?? props.goal.milestones.length + 1,
    status: props.milestone?.status ?? 'Active' as MilestoneStatus,
    dueDate: props.milestone?.dueDate ?? ''
  });

  return (
    <EditorShell title={props.milestone ? 'Edit milestone' : 'Create milestone'} onCancel={props.onCancel}>
      <form className="editor-form" onSubmit={(event) => {
        event.preventDefault();
        props.onSave({
          ...draft,
          dueDate: draft.dueDate || null
        });
      }}>
        <p className="muted-copy">Goal: {props.goal.title}</p>
        <TextField label="Title" value={draft.title} onChange={(title) => setDraft({ ...draft, title })} required />
        <TextArea label="Description" value={draft.description} onChange={(description) => setDraft({ ...draft, description })} />
        <div className="form-grid two">
          <SelectField label="Type" value={draft.type} onChange={(type) => setDraft({ ...draft, type: type as MilestoneType })} options={milestoneTypes.map(toOption)} />
          <SelectField label="Status" value={draft.status} onChange={(status) => setDraft({ ...draft, status: status as MilestoneStatus })} options={milestoneStatuses.map(toOption)} />
        </div>
        <div className="form-grid three">
          <NumberField label="Current" value={draft.currentValue} onChange={(currentValue) => setDraft({ ...draft, currentValue })} />
          <NumberField label="Target" value={draft.targetValue} onChange={(targetValue) => setDraft({ ...draft, targetValue })} />
          <TextField label="Unit" value={draft.unit} onChange={(unit) => setDraft({ ...draft, unit })} />
        </div>
        <div className="form-grid two">
          <NumberField label="Order" value={draft.sortOrder} onChange={(sortOrder) => setDraft({ ...draft, sortOrder })} />
          <label className="field"><span>Due date</span><input type="date" value={draft.dueDate ?? ''} onChange={(event) => setDraft({ ...draft, dueDate: event.target.value })} /></label>
        </div>
        <div className="button-row">
          <button disabled={props.busy}>{props.milestone ? 'Save milestone' : 'Create milestone'}</button>
          {props.onDelete && <button type="button" className="danger-button" disabled={props.busy} onClick={props.onDelete}>Delete</button>}
        </div>
      </form>
    </EditorShell>
  );
}

function ActivityForm(props: { activity: Activity | null; areas: LifeArea[]; goals: Goal[]; busy: boolean; onSave: (body: unknown) => void; onCancel: () => void; onDelete?: () => void; onComplete?: (id: string) => void; onSkip?: (id: string) => void }) {
  const isExisting = Boolean(props.activity?.id);
  const selectedGoal = props.goals.find((goal) => goal.id === props.activity?.goalId);
  const initialExercises = parseWorkoutExercises(props.activity?.notes ?? '');
  const [draft, setDraft] = useState({
    lifeAreaId: props.activity?.lifeAreaId ?? props.areas[0]?.id ?? '',
    goalId: props.activity?.goalId ?? '',
    milestoneId: props.activity?.milestoneId ?? null,
    templateId: props.activity?.templateId ?? null,
    title: props.activity?.title ?? '',
    description: props.activity?.description ?? '',
    plannedStartAt: props.activity?.plannedStartAt ? toLocalInput(new Date(props.activity.plannedStartAt)) : toLocalInput(new Date()),
    durationMinutes: props.activity?.durationMinutes ?? 45,
    status: props.activity?.status ?? 'Planned' as ActivityStatus,
    energyCost: props.activity?.energyCost ?? 'Medium' as LoadLevel,
    mentalLoad: props.activity?.mentalLoad ?? 'Medium' as LoadLevel,
    physicalLoad: props.activity?.physicalLoad ?? 'Low' as LoadLevel,
    points: props.activity?.points ?? 5,
    notes: stripWorkoutNotes(props.activity?.notes ?? '')
  });
  const [exercises, setExercises] = useState<WorkoutExercise[]>(initialExercises.length ? initialExercises : [createExercise()]);
  const availableMilestones = props.goals.find((goal) => goal.id === draft.goalId)?.milestones ?? selectedGoal?.milestones ?? [];
  const isWorkout = /hypertrophy workout|gym session/i.test(draft.title);

  return (
    <EditorShell title={isExisting ? 'Edit activity' : 'Plan activity'} onCancel={props.onCancel}>
      {isExisting && props.activity && <div className="activity-status-actions">
        <span className={`status-badge ${props.activity.status.toLowerCase()}`}>{props.activity.status}</span>
        {props.activity.status !== 'Completed' && props.onComplete && <button type="button" disabled={props.busy || !canCompleteActivity(props.activity)} title={!canCompleteActivity(props.activity) ? 'A future planned activity cannot be completed early.' : undefined} onClick={() => { props.onComplete?.(props.activity!.id); props.onCancel(); }}>{props.activity.status === 'Skipped' || props.activity.status === 'Cancelled' ? 'Mark done' : 'Done'}</button>}
        {props.activity.status === 'Completed' && props.onSkip && <button type="button" className="secondary-button" disabled={props.busy} onClick={() => { props.onSkip?.(props.activity!.id); props.onCancel(); }}>Mark skipped</button>}
        {(props.activity.status === 'Planned' || props.activity.status === 'Moved') && props.onSkip && <button type="button" className="secondary-button" disabled={props.busy} onClick={() => { props.onSkip?.(props.activity!.id); props.onCancel(); }}>Skip</button>}
      </div>}
      <form className="editor-form" onSubmit={(event) => {
        event.preventDefault();
        const start = new Date(draft.plannedStartAt);
        const end = new Date(start.getTime() + Number(draft.durationMinutes) * 60000);
        const completed = draft.status === 'Completed';
        props.onSave({
          ...draft,
          notes: isWorkout ? serializeWorkoutNotes(draft.notes, exercises.filter((exercise) => exercise.name.trim())) : draft.notes,
          goalId: draft.goalId || null,
          plannedStartAt: start.toISOString(),
          plannedEndAt: end.toISOString(),
          actualStartAt: completed ? (props.activity?.actualStartAt ?? start.toISOString()) : null,
          actualEndAt: completed ? (props.activity?.actualEndAt ?? end.toISOString()) : null
        });
      }}>
        <TextField label="Title" value={draft.title} onChange={(title) => setDraft({ ...draft, title })} required />
        <TextArea label="Description" value={draft.description} onChange={(description) => setDraft({ ...draft, description })} />
        <SelectField label="Life area" value={draft.lifeAreaId} onChange={(lifeAreaId) => setDraft({ ...draft, lifeAreaId })} options={props.areas.map((area) => ({ value: area.id, label: area.name }))} />
        <SelectField label="Goal" value={draft.goalId} onChange={(goalId) => setDraft({ ...draft, goalId, milestoneId: null })} options={[{ value: '', label: 'No goal' }, ...props.goals.map((goal) => ({ value: goal.id, label: goal.title }))]} />
        <SelectField label="Milestone" value={draft.milestoneId ?? ''} onChange={(milestoneId) => setDraft({ ...draft, milestoneId: milestoneId || null })} options={[{ value: '', label: 'No milestone' }, ...availableMilestones.map((milestone) => ({ value: milestone.id, label: milestone.title }))]} />
        <div className="form-grid two">
          <label className="field"><span>{draft.status === 'Completed' ? 'Completed at' : 'Start'}</span><input type="datetime-local" value={draft.plannedStartAt} max={draft.status === 'Completed' ? toLocalInput(new Date()) : undefined} onChange={(event) => setDraft({ ...draft, plannedStartAt: event.target.value })} /></label>
          <NumberField label="Minutes" value={draft.durationMinutes} onChange={(durationMinutes) => setDraft({ ...draft, durationMinutes })} />
        </div>
        <div className="form-grid two">
          {!isExisting && <SelectField label="Status" value={draft.status} onChange={(status) => setDraft({ ...draft, status: status as ActivityStatus })} options={activityStatuses.map(toOption)} />}
          <NumberField label="Points" value={draft.points} onChange={(points) => setDraft({ ...draft, points })} />
        </div>
        <div className="form-grid three">
          <SelectField label="Energy" value={draft.energyCost} onChange={(energyCost) => setDraft({ ...draft, energyCost: energyCost as LoadLevel })} options={loadLevels.map(toOption)} />
          <SelectField label="Mental" value={draft.mentalLoad} onChange={(mentalLoad) => setDraft({ ...draft, mentalLoad: mentalLoad as LoadLevel })} options={loadLevels.map(toOption)} />
          <SelectField label="Physical" value={draft.physicalLoad} onChange={(physicalLoad) => setDraft({ ...draft, physicalLoad: physicalLoad as LoadLevel })} options={loadLevels.map(toOption)} />
        </div>
        {isWorkout && <WorkoutExerciseEditor exercises={exercises} onChange={setExercises} />}
        <TextArea label="Notes" value={draft.notes} onChange={(notes) => setDraft({ ...draft, notes })} />
        <div className="button-row">
          <button disabled={props.busy}>{isExisting ? 'Save changes' : 'Plan activity'}</button>
          {props.onDelete && <button type="button" className="danger-button" disabled={props.busy} onClick={props.onDelete}>Delete activity</button>}
        </div>
      </form>
    </EditorShell>
  );
}

function TemplateForm(props: { template: ActivityTemplate | null; areas: LifeArea[]; busy: boolean; onSave: (body: unknown) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState({
    lifeAreaId: props.template?.lifeAreaId ?? props.areas[0]?.id ?? '',
    title: props.template?.title ?? '',
    description: props.template?.description ?? '',
    defaultDurationMinutes: props.template?.defaultDurationMinutes ?? 45,
    energyCost: props.template?.energyCost ?? 'Medium' as LoadLevel,
    mentalLoad: props.template?.mentalLoad ?? 'Medium' as LoadLevel,
    physicalLoad: props.template?.physicalLoad ?? 'Low' as LoadLevel,
    defaultPoints: props.template?.defaultPoints ?? 5,
    isActive: props.template?.isActive ?? true
  });

  return (
    <EditorShell title={props.template ? 'Edit template' : 'Create template'} onCancel={props.onCancel}>
      <form className="editor-form" onSubmit={(event) => {
        event.preventDefault();
        props.onSave(draft);
      }}>
        <TextField label="Title" value={draft.title} onChange={(title) => setDraft({ ...draft, title })} required />
        <TextArea label="Description" value={draft.description} onChange={(description) => setDraft({ ...draft, description })} />
        <SelectField label="Life area" value={draft.lifeAreaId} onChange={(lifeAreaId) => setDraft({ ...draft, lifeAreaId })} options={props.areas.map((area) => ({ value: area.id, label: area.name }))} />
        <div className="form-grid two">
          <NumberField label="Default minutes" value={draft.defaultDurationMinutes} onChange={(defaultDurationMinutes) => setDraft({ ...draft, defaultDurationMinutes })} />
          <NumberField label="Default points" value={draft.defaultPoints} onChange={(defaultPoints) => setDraft({ ...draft, defaultPoints })} />
        </div>
        <div className="form-grid three">
          <SelectField label="Energy" value={draft.energyCost} onChange={(energyCost) => setDraft({ ...draft, energyCost: energyCost as LoadLevel })} options={loadLevels.map(toOption)} />
          <SelectField label="Mental" value={draft.mentalLoad} onChange={(mentalLoad) => setDraft({ ...draft, mentalLoad: mentalLoad as LoadLevel })} options={loadLevels.map(toOption)} />
          <SelectField label="Physical" value={draft.physicalLoad} onChange={(physicalLoad) => setDraft({ ...draft, physicalLoad: physicalLoad as LoadLevel })} options={loadLevels.map(toOption)} />
        </div>
        <label className="check-field"><input type="checkbox" checked={draft.isActive} onChange={(event) => setDraft({ ...draft, isActive: event.target.checked })} /> Active</label>
        <button disabled={props.busy}>{props.template ? 'Save template' : 'Create template'}</button>
      </form>
    </EditorShell>
  );
}

function RecurrenceRuleForm(props: { template: ActivityTemplate; rule: RecurrenceRule | null; busy: boolean; onSave: (body: unknown) => void; onDelete?: () => void; onCancel: () => void }) {
  const initialDays = parseDayList(props.rule?.daysOfWeek);
  const [draft, setDraft] = useState({
    templateId: props.template.id,
    frequency: props.rule?.frequency ?? 'Weekly' as RecurrenceFrequency,
    interval: props.rule?.interval ?? 1,
    daysOfWeek: initialDays,
    startDate: props.rule?.startDate ?? toDateInput(new Date()),
    endDate: props.rule?.endDate ?? ''
  });

  function toggleDay(day: string) {
    const days = draft.daysOfWeek.includes(day)
      ? draft.daysOfWeek.filter((item) => item !== day)
      : [...draft.daysOfWeek, day];
    setDraft({ ...draft, daysOfWeek: days });
  }

  return (
    <EditorShell title={props.rule ? 'Edit recurrence' : 'Create recurrence'} onCancel={props.onCancel}>
      <form className="editor-form" onSubmit={(event) => {
        event.preventDefault();
        props.onSave({
          templateId: props.template.id,
          frequency: draft.frequency,
          interval: draft.interval,
          daysOfWeek: draft.frequency === 'Weekly' ? draft.daysOfWeek.join(',') : '',
          startDate: draft.startDate,
          endDate: draft.endDate || null
        });
      }}>
        <p className="muted-copy">Template: {props.template.title}. Generated activities start at 09:00.</p>
        <div className="form-grid two">
          <SelectField label="Frequency" value={draft.frequency} onChange={(frequency) => setDraft({ ...draft, frequency: frequency as RecurrenceFrequency })} options={recurrenceFrequencies.map(toOption)} />
          <NumberField label="Interval" value={draft.interval} onChange={(interval) => setDraft({ ...draft, interval })} />
        </div>
        {draft.frequency === 'Weekly' && (
          <div className="day-toggle-grid">
            {weekDays.map((day) => (
              <label className="check-field" key={day}>
                <input type="checkbox" checked={draft.daysOfWeek.includes(day)} onChange={() => toggleDay(day)} />
                {day.slice(0, 3)}
              </label>
            ))}
          </div>
        )}
        <div className="form-grid two">
          <label className="field"><span>Start date</span><input type="date" value={draft.startDate} onChange={(event) => setDraft({ ...draft, startDate: event.target.value })} /></label>
          <label className="field"><span>End date</span><input type="date" value={draft.endDate ?? ''} onChange={(event) => setDraft({ ...draft, endDate: event.target.value })} /></label>
        </div>
        <div className="button-row">
          <button disabled={props.busy}>{props.rule ? 'Save recurrence' : 'Create recurrence'}</button>
          {props.onDelete && <button type="button" className="danger-button" disabled={props.busy} onClick={props.onDelete}>Delete</button>}
        </div>
      </form>
    </EditorShell>
  );
}

function MetricForm(props: { metric: Metric | null; areas: LifeArea[]; goals: Goal[]; busy: boolean; onSave: (body: unknown) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState({
    lifeAreaId: props.metric?.lifeAreaId ?? '',
    goalId: props.metric?.goalId ?? '',
    name: props.metric?.name ?? '',
    unit: props.metric?.unit ?? '',
    valueType: props.metric?.valueType ?? 'Number' as MetricValueType,
    targetValue: props.metric?.targetValue ?? '',
    sortOrder: 0,
    isActive: props.metric?.isActive ?? true
  });

  return (
    <EditorShell title={props.metric ? 'Edit metric' : 'Create metric'} onCancel={props.onCancel}>
      <form className="editor-form" onSubmit={(event) => {
        event.preventDefault();
        props.onSave({
          ...draft,
          lifeAreaId: draft.lifeAreaId || null,
          goalId: draft.goalId || null,
          targetValue: draft.targetValue === '' ? null : Number(draft.targetValue)
        });
      }}>
        <TextField label="Name" value={draft.name} onChange={(name) => setDraft({ ...draft, name })} required />
        <div className="form-grid two">
          <TextField label="Unit" value={draft.unit} onChange={(unit) => setDraft({ ...draft, unit })} />
          <SelectField label="Type" value={draft.valueType} onChange={(valueType) => setDraft({ ...draft, valueType: valueType as MetricValueType })} options={metricTypes.map(toOption)} />
        </div>
        <SelectField label="Life area" value={draft.lifeAreaId} onChange={(lifeAreaId) => setDraft({ ...draft, lifeAreaId })} options={[{ value: '', label: 'No area' }, ...props.areas.map((area) => ({ value: area.id, label: area.name }))]} />
        <SelectField label="Goal" value={draft.goalId} onChange={(goalId) => setDraft({ ...draft, goalId })} options={[{ value: '', label: 'No goal' }, ...props.goals.map((goal) => ({ value: goal.id, label: goal.title }))]} />
        <NumberOrBlankField label="Target value" value={draft.targetValue} onChange={(targetValue) => setDraft({ ...draft, targetValue })} />
        <label className="check-field"><input type="checkbox" checked={draft.isActive} onChange={(event) => setDraft({ ...draft, isActive: event.target.checked })} /> Active</label>
        <button disabled={props.busy}>{props.metric ? 'Save changes' : 'Create metric'}</button>
      </form>
    </EditorShell>
  );
}

function FocusPanel(props: { title: string; activity?: Activity; busy: boolean; onComplete: (id: string) => void; onSkip: (id: string) => void; onEdit?: (activity: Activity) => void; onCreate?: () => void }) {
  return (
    <article className="surface focus-panel">
      <div className="collection-header flush-header">
        <SectionTitle kicker="Today" title={props.title} />
        {props.activity && props.onEdit ? <button className="secondary-button" onClick={() => props.onEdit?.(props.activity!)}>Edit</button> : props.onCreate ? <button onClick={props.onCreate}>Set focus</button> : null}
      </div>
      {props.activity ? <ActivityRow activity={props.activity} busy={props.busy} onComplete={props.onComplete} onSkip={props.onSkip} /> : <EmptyState text="Nothing assigned." />}
    </article>
  );
}

function ActivityList(props: {
  activities: Activity[];
  busy: boolean;
  onComplete: (id: string) => void;
  onSkip: (id: string) => void;
  onEdit?: (activity: Activity) => void;
  onDelete?: (id: string) => void;
}) {
  if (props.activities.length === 0) {
    return <EmptyState text="No activities yet." />;
  }

  return (
    <div className="activity-list">
      {props.activities.map((activity) => (
        <ActivityRow key={activity.id} activity={activity} busy={props.busy} onComplete={props.onComplete} onSkip={props.onSkip} onEdit={props.onEdit} onDelete={props.onDelete} />
      ))}
    </div>
  );
}

function ActivityRow(props: {
  activity: Activity;
  busy: boolean;
  onComplete: (id: string) => void;
  onSkip: (id: string) => void;
  onEdit?: (activity: Activity) => void;
  onDelete?: (id: string) => void;
}) {
  const isOpen = props.activity.status === 'Planned' || props.activity.status === 'Moved';
  const isSkipped = props.activity.status === 'Skipped' || props.activity.status === 'Cancelled';
  const canComplete = canCompleteActivity(props.activity);
  return (
    <div className="activity-row">
      <span className="activity-marker" style={{ background: props.activity.lifeAreaColor }} />
      <div>
        <strong>{props.activity.title}</strong>
        <p>{props.activity.lifeAreaName} · {activityDisplayMeasure(props.activity)} · {props.activity.status}</p>
      </div>
      <div className="row-actions">
        {(isOpen || isSkipped) && <button disabled={props.busy || !canComplete} title={!canComplete ? 'A future planned activity cannot be completed early.' : undefined} onClick={() => props.onComplete(props.activity.id)}>{isSkipped ? 'Mark done' : 'Done'}</button>}
        {(isOpen || props.activity.status === 'Completed') && <button className="secondary-button" disabled={props.busy} onClick={() => props.onSkip(props.activity.id)}>{props.activity.status === 'Completed' ? 'Mark skipped' : 'Skip'}</button>}
        {props.onEdit && <button className="secondary-button" onClick={() => props.onEdit?.(props.activity)}>Edit</button>}
        {props.onDelete && <button className="danger-button" onClick={() => props.onDelete?.(props.activity.id)}>Delete</button>}
      </div>
    </div>
  );
}

function EditorShell(props: { title: string; children: React.ReactNode; onCancel: () => void }) {
  return (
    <section className="surface editor-shell">
      <div className="editor-heading">
        <SectionTitle kicker="Editor" title={props.title} />
        <button className="ghost-button compact" onClick={props.onCancel}>Clear</button>
      </div>
      {props.children}
    </section>
  );
}

function SectionTitle({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="section-title">
      <p className="eyebrow">{kicker}</p>
      <h3>{title}</h3>
    </div>
  );
}

function ReviewPlanningPanel(props: { reviews: Review[]; activities: Activity[]; goals: Goal[] }) {
  const periods = [...props.reviews].sort((first, second) => first.periodStart.localeCompare(second.periodStart)).slice(-8).map((review) => {
    const rows = props.activities.filter((activity) => {
      const activityDate = getActivityDate(activity);
      if (!activityDate) return false;
      const key = localDateKey(activityDate);
      return key >= review.periodStart && key <= review.periodEnd;
    });
    return {
      review,
      done: rows.filter((activity) => activity.status === 'Completed').length,
      skipped: rows.filter((activity) => activity.status === 'Skipped' || activity.status === 'Cancelled').length,
      minutes: rows.filter((activity) => activity.status === 'Completed' && isDurationActivity(activity.title)).reduce((sum, activity) => sum + activity.durationMinutes, 0)
    };
  });
  const ceiling = Math.max(1, ...periods.map((period) => period.done + period.skipped));
  const latest = [...props.reviews].sort((first, second) => second.periodEnd.localeCompare(first.periodEnd))[0];
  const activeGoals = props.goals.filter((goal) => goal.status === 'Active').sort((first, second) => first.priority.localeCompare(second.priority)).slice(0, 4);

  return <section className="surface review-planning-panel">
    <div className="collection-header flush-header"><SectionTitle kicker="Plan from evidence" title="Review trends" /><span className="status-badge maintained">{periods.length} periods</span></div>
    <div className="review-planning-grid">
      <article className="compact-chart"><div className="chart-heading"><strong>Execution by period</strong><span>Done vs skipped</span></div><div className="review-period-chart">{periods.map((period) => <div key={period.review.id}><div><i className="done" style={{ height: `${period.done / ceiling * 100}%` }} /><i className="skipped" style={{ height: `${period.skipped / ceiling * 100}%` }} /></div><strong>{period.done}/{period.skipped}</strong><small>{period.review.periodEnd.slice(5)}</small></div>)}</div>{periods.length === 0 && <EmptyState text="Generate a review to build the trend." />}</article>
      <article className="review-next-plan"><div><span className="eyebrow">Carry forward</span><h4>{latest?.nextFocus || 'Choose the next concrete focus in your latest review.'}</h4><p>{latest ? `${latest.type} review ending ${latest.periodEnd}` : 'No review generated yet.'}</p></div><div className="planning-goals">{activeGoals.map((goal) => <div key={goal.id}><i style={{ background: goal.lifeAreaColor }} /><span><strong>{goal.title}</strong><small>{goal.lifeAreaName} · {goal.priority}</small></span></div>)}</div></article>
    </div>
  </section>;
}

function EditorDrawer(props: { open: boolean; label: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!props.open) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') props.onClose();
    }

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [props.open, props.onClose]);

  if (!props.open) return null;

  return (
    <>
      <button className="goal-drawer-backdrop" aria-label={`Close ${props.label}`} onClick={props.onClose} />
      <aside className="goals-editor-panel app-editor-drawer" aria-label={props.label}>
        {props.children}
      </aside>
    </>
  );
}

function VaporNavButton(props: { item: { label: string; kicker: string; icon: string }; isActive: boolean; onSelect: () => void }) {
  return (
    <button className={props.isActive ? 'vapor-nav-button active' : 'vapor-nav-button'} onClick={props.onSelect}>
      <i className="nav-glyph" aria-hidden="true">{props.item.icon}</i>
      <span className="nav-copy">
        <small>{props.item.kicker}</small>
        <strong>{props.item.label}</strong>
      </span>
    </button>
  );
}

function GoalProgressRing(props: { value: number; color: string; label: string; size?: 'small' | 'large' }) {
  const value = Math.max(0, Math.min(100, Number(props.value) || 0));
  return <div className={`goal-progress-ring ${props.size ?? 'large'}`} style={{ '--ring-value': `${value * 3.6}deg`, '--ring-color': props.color } as React.CSSProperties} aria-label={`${props.label}: ${value}%`}>
    <div><strong>{Math.round(value)}%</strong><span>{props.label}</span></div>
  </div>;
}

function SummaryPill({ label, value }: { label: string; value: string | number }) {
  return <div className="summary-pill"><span>{label}</span><strong>{value}</strong><i aria-hidden="true" /></div>;
}

function EmptyState({ text }: { text: string }) {
  return <p className="empty-state">{text}</p>;
}

function PaginationControls(props: { page: number; totalPages: number; totalItems: number; onPage: (page: number) => void }) {
  if (props.totalPages <= 1) {
    return null;
  }

  return (
    <div className="pagination-bar">
      <span>{props.totalItems} items · page {props.page} of {props.totalPages}</span>
      <div className="button-row">
        <button className="secondary-button" disabled={props.page <= 1} onClick={() => props.onPage(props.page - 1)}>Previous</button>
        <button className="secondary-button" disabled={props.page >= props.totalPages} onClick={() => props.onPage(props.page + 1)}>Next</button>
      </div>
    </div>
  );
}

function ValidationBox(props: { validation: BackupValidation; title?: string; detail?: string }) {
  return (
    <div className={props.validation.isValid ? 'validation-box valid' : 'validation-box invalid'}>
      <strong>{props.title ?? (props.validation.isValid ? 'Backup is valid' : 'Backup is invalid')}</strong>
      <span>{props.validation.message}</span>
      {props.detail && <small>{props.detail}</small>}
      {props.validation.manifest && <small>Exported {formatDateTime(props.validation.manifest.exportedAt)} · schema {props.validation.manifest.schemaVersion}</small>}
    </div>
  );
}

function CountdownForm(props: { countdown: Countdown | null; busy: boolean; onSave: (body: unknown) => void; onCancel: () => void }) {
  const defaultTarget = new Date();
  defaultTarget.setDate(defaultTarget.getDate() + 30);
  const [draft, setDraft] = useState({
    title: props.countdown?.title ?? '',
    description: props.countdown?.description ?? '',
    targetAt: props.countdown?.targetAt ? toLocalInput(new Date(props.countdown.targetAt)) : toLocalInput(defaultTarget),
    category: props.countdown?.category ?? '',
    color: props.countdown?.color ?? '#ff2fa6',
    isPinned: props.countdown?.isPinned ?? true,
    isArchived: props.countdown?.isArchived ?? false
  });

  return (
    <EditorShell title={props.countdown ? 'Edit countdown' : 'Create countdown'} onCancel={props.onCancel}>
      <form className="editor-form" onSubmit={(event) => {
        event.preventDefault();
        props.onSave({
          ...draft,
          targetAt: new Date(draft.targetAt).toISOString()
        });
      }}>
        <TextField label="Title" value={draft.title} onChange={(title) => setDraft({ ...draft, title })} required />
        <TextArea label="Description" value={draft.description} onChange={(description) => setDraft({ ...draft, description })} />
        <div className="form-grid two">
          <label className="field"><span>Target date</span><input type="datetime-local" value={draft.targetAt} onChange={(event) => setDraft({ ...draft, targetAt: event.target.value })} /></label>
          <TextField label="Category" value={draft.category} onChange={(category) => setDraft({ ...draft, category })} />
        </div>
        <div className="form-grid two">
          <label className="field">
            <span>Hex color</span>
            <input value={draft.color} onChange={(event) => setDraft({ ...draft, color: event.target.value })} pattern="^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$" />
          </label>
          <label className="field">
            <span>Color picker</span>
            <input type="color" value={isHexColor(draft.color) ? draft.color : '#ff2fa6'} onChange={(event) => setDraft({ ...draft, color: event.target.value })} />
          </label>
        </div>
        <div className="form-grid two">
          <label className="check-field"><input type="checkbox" checked={draft.isPinned} onChange={(event) => setDraft({ ...draft, isPinned: event.target.checked })} /> Pinned</label>
          <label className="check-field"><input type="checkbox" checked={draft.isArchived} onChange={(event) => setDraft({ ...draft, isArchived: event.target.checked })} /> Archived</label>
        </div>
        <button disabled={props.busy}>{props.countdown ? 'Save countdown' : 'Create countdown'}</button>
      </form>
    </EditorShell>
  );
}

function PhysiqueEntryForm(props: { entry: PhysiqueEntry | null; baseline: PhysiqueEntry | null; busy: boolean; onSave: (body: unknown) => void; onCancel: () => void }) {
  const source = props.entry ?? props.baseline;
  const [draft, setDraft] = useState({
    recordedAt: props.entry?.recordedAt ? toLocalInput(new Date(props.entry.recordedAt)) : toLocalInput(new Date()),
    age: source?.age ?? 27,
    sex: source?.sex ?? 'Male',
    heightCm: source?.heightCm ?? 175,
    weightKg: source?.weightKg ?? 74,
    waistCm: String(source?.waistCm ?? ''),
    neckCm: String(source?.neckCm ?? ''),
    hipCm: String(source?.hipCm ?? ''),
    moodScore: source?.moodScore ?? 5,
    status: props.entry?.status ?? '',
    notes: props.entry?.notes ?? ''
  });

  return (
    <EditorShell title="Log physique" onCancel={props.onCancel}>
      <form className="editor-form" onSubmit={(event) => {
        event.preventDefault();
        props.onSave({
          ...draft,
          recordedAt: new Date(draft.recordedAt).toISOString(),
          waistCm: blankToNull(draft.waistCm),
          neckCm: blankToNull(draft.neckCm),
          hipCm: blankToNull(draft.hipCm),
          bodyFatPercentOverride: null,
          muscleMassKg: null
        });
      }}>
        <div className="form-grid two">
          <label className="field"><span>Recorded at</span><input type="datetime-local" max={toLocalInput(new Date())} value={draft.recordedAt} onChange={(event) => setDraft({ ...draft, recordedAt: event.target.value })} /></label>
          <SelectField label="Sex" value={draft.sex} onChange={(sex) => setDraft({ ...draft, sex })} options={[{ value: 'Male', label: 'Male' }, { value: 'Female', label: 'Female' }]} />
        </div>
        <div className="form-grid three">
          <NumberField label="Age" value={draft.age} onChange={(age) => setDraft({ ...draft, age })} />
          <NumberField label="Height cm" value={draft.heightCm} onChange={(heightCm) => setDraft({ ...draft, heightCm })} />
          <NumberField label="Weight kg" value={draft.weightKg} onChange={(weightKg) => setDraft({ ...draft, weightKg })} />
        </div>
        <div className="form-grid three">
          <NumberOrBlankField label="Waist cm" value={draft.waistCm} onChange={(waistCm) => setDraft({ ...draft, waistCm })} />
          <NumberOrBlankField label="Neck cm" value={draft.neckCm} onChange={(neckCm) => setDraft({ ...draft, neckCm })} />
          <NumberOrBlankField label="Hip cm" value={draft.hipCm} onChange={(hipCm) => setDraft({ ...draft, hipCm })} />
        </div>
        <p className="form-hint">Body fat, fat mass, lean mass, BMI, and FFMI are calculated automatically from these measurements.</p>
        <div className="form-grid three">
          <NumberField label="Mood 1-10" value={draft.moodScore} onChange={(moodScore) => setDraft({ ...draft, moodScore })} />
        </div>
        <TextField label="Status" value={draft.status} onChange={(status) => setDraft({ ...draft, status })} />
        <TextArea label="Notes" value={draft.notes} onChange={(notes) => setDraft({ ...draft, notes })} />
        <button disabled={props.busy}>{props.entry?.id ? 'Save physique entry' : 'Log physique'}</button>
      </form>
    </EditorShell>
  );
}

function PhysiqueDiagram({ entry, entries }: { entry?: PhysiqueEntry; entries: PhysiqueEntry[] }) {
  const bodyFat = entry?.estimatedBodyFatPercent ?? 18;
  const weight = entry?.weightKg ?? 74;
  const waist = entry?.waistCm ?? 80;
  const torsoWidth = Math.max(48, Math.min(92, 58 + (weight - 65) * 0.7));
  const waistWidth = Math.max(34, Math.min(88, 38 + (waist - 65) * 1.15));
  const history = [...entries]
    .sort((first, second) => new Date(first.recordedAt).getTime() - new Date(second.recordedAt).getTime())
    .slice(-12);
  const weights = history.map((item) => item.weightKg);
  const minimum = Math.min(...weights, weight) - 1;
  const maximum = Math.max(...weights, weight) + 1;
  const range = Math.max(1, maximum - minimum);
  const weightPoints = history.map((item, index) => {
    const x = history.length === 1 ? 50 : index / (history.length - 1) * 100;
    return `${x},${90 - (item.weightKg - minimum) / range * 72}`;
  }).join(' ');

  return (
    <div className="physique-diagram" aria-label="Physique composition diagram">
      <div className="body-orbit" />
      <div className="body-silhouette">
        <span className="body-head" />
        <span className="body-torso" style={{ width: `${torsoWidth}%` }} />
        <span className="body-waist" style={{ width: `${waistWidth}%` }} />
        <span className="body-legs" />
      </div>
      <div className="body-readout">
        <div><strong>{weight} kg</strong><span>{waist} cm waist · {entry?.estimatedBodyFatPercent ? `${bodyFat}% fat` : 'tape needed'}</span></div>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Recent body weight trend">
          <polyline points={weightPoints} />
          {history.map((item, index) => {
            const x = history.length === 1 ? 50 : index / (history.length - 1) * 100;
            const y = 90 - (item.weightKg - minimum) / range * 72;
            return <circle key={item.id} cx={x} cy={y} r="2.4" />;
          })}
        </svg>
        <small>Weight trend · last {history.length} logs</small>
      </div>
    </div>
  );
}

function TextField(props: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) {
  return <label className="field"><span>{props.label}</span><input value={props.value} onChange={(event) => props.onChange(event.target.value)} required={props.required} /></label>;
}

function TextArea(props: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="field full"><span>{props.label}</span><textarea value={props.value} onChange={(event) => props.onChange(event.target.value)} /></label>;
}

function NumberField(props: { label: string; value: number; onChange: (value: number) => void }) {
  return <label className="field"><span>{props.label}</span><input type="number" value={props.value} onChange={(event) => props.onChange(Number(event.target.value))} /></label>;
}

function NumberOrBlankField(props: { label: string; value: string | number; onChange: (value: string) => void }) {
  return <label className="field"><span>{props.label}</span><input type="number" value={props.value} onChange={(event) => props.onChange(event.target.value)} /></label>;
}

function SelectField(props: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return (
    <label className="field">
      <span>{props.label}</span>
      <select value={props.value} onChange={(event) => props.onChange(event.target.value)}>
        {props.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function toOption(value: string) {
  return { value, label: value };
}

function blankToNull(value: string) {
  return value.trim() === '' ? null : Number(value);
}

function getCalendarDays(view: CalendarView, anchorDate: Date) {
  if (view === 'day') {
    return [startOfDay(anchorDate)];
  }

  const firstDay = startOfWeek(anchorDate);
  return Array.from({ length: 7 }, (_, index) => addDays(firstDay, index));
}

function buildMonthGrid(anchorDate: Date) {
  const monthStart = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
  const gridStart = startOfWeek(monthStart);
  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
}

function formatCalendarRange(view: CalendarView, anchorDate: Date) {
  if (view === 'day') {
    return anchorDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }

  if (view === 'month') {
    return anchorDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }

  const start = startOfWeek(anchorDate);
  const end = addDays(start, 6);
  return `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

function startOfWeek(date: Date) {
  const copy = startOfDay(date);
  const diff = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - diff);
  return copy;
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return startOfDay(copy);
}

function addMonths(date: Date, months: number) {
  const copy = new Date(date);
  copy.setMonth(copy.getMonth() + months, 1);
  return startOfDay(copy);
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function sameDay(value: string | undefined, date: Date) {
  if (!value) return false;
  return new Date(value).toDateString() === date.toDateString();
}

function sameMonth(value: string | Date | undefined, date: Date) {
  if (!value) return false;
  const parsed = typeof value === 'string' ? new Date(value) : value;
  return parsed.getFullYear() === date.getFullYear() && parsed.getMonth() === date.getMonth();
}

function isToday(date: Date) {
  return startOfDay(date).getTime() === startOfDay(new Date()).getTime();
}

function getActivityDate(activity: Activity) {
  return activity.actualStartAt ?? activity.plannedStartAt;
}

function canCompleteActivity(activity: Activity) {
  if (activity.status === 'Skipped' || activity.status === 'Cancelled') return true;
  const activityDate = getActivityDate(activity);
  return !activityDate || startOfDay(new Date(activityDate)).getTime() <= startOfDay(new Date()).getTime();
}

function createExercise(): WorkoutExercise {
  return { id: `exercise-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: '', muscle: 'Chest', sets: 3, reps: 10, weightKg: 0, rir: 2 };
}

function serializeWorkoutNotes(notes: string, exercises: WorkoutExercise[]) {
  const clean = stripWorkoutNotes(notes).trim();
  if (exercises.length === 0) return clean;
  return `${clean}${clean ? '\n\n' : ''}${workoutMarker}${JSON.stringify(exercises)}`;
}

function stripWorkoutNotes(notes: string) {
  const markerIndex = notes.indexOf(workoutMarker);
  return (markerIndex >= 0 ? notes.slice(0, markerIndex) : notes).trim();
}

function parseWorkoutExercises(notes: string): WorkoutExercise[] {
  const markerIndex = notes.indexOf(workoutMarker);
  if (markerIndex < 0) return [];
  try {
    const value = JSON.parse(notes.slice(markerIndex + workoutMarker.length));
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is WorkoutExercise => item && typeof item.name === 'string' && typeof item.muscle === 'string')
      .map((item) => ({ ...item, id: item.id || createExercise().id, sets: Number(item.sets) || 1, reps: Number(item.reps) || 1, weightKg: Number(item.weightKg) || 0, rir: Number.isFinite(Number(item.rir)) ? Number(item.rir) : 2 }));
  } catch {
    return [];
  }
}

function isDurationActivity(title: string) {
  return !isBinaryCheckIn(title) && title !== 'Sleep log';
}

function isBinaryCheckIn(title: string) {
  return ['Creatine dose', 'Desk mobility reset', 'No alcohol check-in', 'No vape check-in', 'Diet check-in', 'SPF 30+', 'Night retinoid', 'Floss teeth'].includes(title);
}

function activityDisplayMeasure(activity: Activity) {
  if (isDurationActivity(activity.title)) return `${activity.durationMinutes}m`;
  const quantity = Number(activity.notes.match(/Quantity:\s*([0-9.]+)/i)?.[1] ?? 0);
  if (activity.title === 'Creatine dose') return quantity ? `${quantity * 5} g logged` : 'dose check-in';
  if (activity.title === 'Sleep log') return quantity ? `${quantity}h sleep` : 'sleep check-in';
  return 'check-in';
}

function getQuickTemplates(templates: ActivityTemplate[]) {
  const templateByTitle = new Map(templates.map((template) => [template.title, template]));
  return [
    'Creatine dose',
    'Desk mobility reset',
    'Hypertrophy workout',
    'DSA problem rep',
    'System design case study',
    'No alcohol check-in',
    'No vape check-in',
    'Diet check-in',
    'Sleep log',
    'SPF 30+',
    'Night retinoid',
    'Floss teeth',
    'Outdoor walk'
  ].map((title) => templateByTitle.get(title)).filter(Boolean) as ActivityTemplate[];
}

function findGoalIdForTemplate(templateTitle: string, goals: Goal[]) {
  const exactMap: Record<string, string> = {
    'Creatine dose': 'Creatine saturation and maintenance',
    'Desk mobility reset': 'Desk mobility and pain-control streak',
    'Hypertrophy workout': 'Lean muscle recomposition',
    'No alcohol check-in': 'Alcohol-free baseline',
    'No vape check-in': 'Vape-free baseline',
    'Diet check-in': 'Diet adherence for leanness',
    'DSA problem rep': 'DSA 250 list x6 repetitions',
    'System design case study': 'System design interview track'
  };
  const targetTitle = exactMap[templateTitle];
  const byExact = targetTitle ? goals.find((goal) => goal.title === targetTitle) : null;
  if (byExact) {
    return byExact.id;
  }

  const lowerTemplate = templateTitle.toLowerCase();
  return goals.find((goal) => lowerTemplate.includes(goal.title.toLowerCase()) || goal.title.toLowerCase().includes(lowerTemplate))?.id ?? null;
}

function compareActivities(first: Activity, second: Activity) {
  return new Date(getActivityDate(first) ?? 0).getTime() - new Date(getActivityDate(second) ?? 0).getTime();
}

function groupCalendarActivities(activities: Activity[]) {
  const groups: Activity[][] = [];
  [...activities].sort(compareActivities).forEach((activity) => {
    const previous = groups.at(-1);
    const previousTime = previous ? new Date(getActivityDate(previous[0]) ?? 0).getTime() : 0;
    const activityTime = new Date(getActivityDate(activity) ?? 0).getTime();
    if (previous && Math.abs(activityTime - previousTime) <= 10 * 60 * 1000) previous.push(activity);
    else groups.push([activity]);
  });
  return groups;
}

function buildSparklinePath(entries: MetricEntry[]) {
  if (entries.length < 2) {
    return '';
  }

  return entries.map((entry, index) => {
    const x = entries.length === 1 ? 0 : index / (entries.length - 1) * 220;
    const y = getSparklineY(entries, entry.value) ?? 58;
    return `${index === 0 ? 'M' : 'L'} ${roundNumber(x)} ${roundNumber(y)}`;
  }).join(' ');
}

function getSparklineY(entries: MetricEntry[], value: number) {
  const values = [...entries.map((entry) => entry.value), value];
  if (values.length === 0) {
    return null;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) {
    return 36;
  }

  return 60 - ((value - min) / (max - min)) * 48;
}

function roundNumber(value: number) {
  return Math.round(value * 10) / 10;
}

function paginate<T>(items: T[], page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;

  return {
    items: items.slice(start, start + pageSize),
    totalPages
  };
}

function minutesToHours(minutes: number) {
  return roundNumber(minutes / 60);
}

function colorMix(color: string, weight: number) {
  return `color-mix(in srgb, ${color} ${Math.round(Math.min(1, weight) * 92)}%, var(--bg-alt))`;
}

function eventStyle(activity: Activity) {
  const start = new Date(getActivityDate(activity) ?? new Date());
  const hourStart = 6;
  const hourHeight = 56;
  const minutesFromStart = (start.getHours() - hourStart) * 60 + start.getMinutes();
  const top = Math.max(0, minutesFromStart / 60 * hourHeight);
  const height = Math.max(34, Math.min(220, activity.durationMinutes / 60 * hourHeight));
  return {
    top: `${top}px`,
    height: `${height}px`
  };
}

function formatHour(hour: number) {
  return `${hour.toString().padStart(2, '0')}:00`;
}

function formatTime(value: string | undefined) {
  return value ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Anytime';
}

function formatShortDate(value: string | undefined) {
  return value ? new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Unscheduled';
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function formatMoney(value: number) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
}

function countdownProgress(countdown: Countdown) {
  if (countdown.isPast) return 100;
  const start = countdown.createdAt ? new Date(countdown.createdAt).getTime() : Date.now();
  const target = new Date(countdown.targetAt).getTime();
  if (target <= start) return 0;
  return Math.max(0, Math.min(100, (Date.now() - start) / (target - start) * 100));
}

function moneySparklinePoints(entries: SavingsEntry[]) {
  const rows = [...entries].sort((first, second) => new Date(first.recordedAt).getTime() - new Date(second.recordedAt).getTime());
  if (rows.length === 0) return '0,34 100,34';
  const min = Math.min(...rows.map((item) => item.amount));
  const max = Math.max(...rows.map((item) => item.amount));
  const range = Math.max(1, max - min);
  return rows.map((item, index) => `${rows.length === 1 ? 50 : index / (rows.length - 1) * 100},${32 - (item.amount - min) / range * 28}`).join(' ');
}

function localDateKey(value: string) {
  const date = new Date(value);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function toLocalInput(date: Date) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function toDateInput(date: Date) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function parseDayList(value: string | undefined) {
  return value?.split(',').map((day) => day.trim()).filter(Boolean) ?? [];
}

function formatRecurrence(rule: RecurrenceRule) {
  const interval = rule.interval > 1 ? `Every ${rule.interval} ` : 'Every ';
  if (rule.frequency === 'Weekly') {
    return `${interval}week${rule.interval > 1 ? 's' : ''}${rule.daysOfWeek ? ` on ${rule.daysOfWeek}` : ''}`;
  }

  return `${interval}${rule.frequency.toLowerCase()}${rule.interval > 1 ? 's' : ''}`;
}

function getGoalHealth(goal: Goal) {
  if (goal.currentValue >= goal.maintenanceThreshold) {
    return 'Maintained';
  }

  if (goal.decayRatePercentPerWeek > 0 && goal.progressType === 'Decay') {
    return 'Decaying';
  }

  return 'Building';
}

function isHexColor(value: string) {
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(value);
}

function confirmDelete(message: string) {
  return window.confirm(message);
}

function readError(error: unknown, fallback: string) {
  if (!(error instanceof Error)) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(error.message) as { message?: string; validation?: { message?: string } };
    return parsed.validation?.message ?? parsed.message ?? error.message;
  } catch {
    return error.message || fallback;
  }
}
