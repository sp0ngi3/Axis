import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
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
  WikiPage
} from './types';

type Page = 'today' | 'log' | 'dashboard' | 'calendar' | 'countdowns' | 'physique' | 'goals' | 'areas' | 'templates' | 'metrics' | 'wiki' | 'reviews' | 'backup';
type Theme = 'light' | 'dark';
type CalendarView = 'day' | 'week' | 'month';

const pages: Array<{ id: Page; label: string; kicker: string; icon: string }> = [
  { id: 'today', label: 'Today', kicker: 'Operate', icon: '//' },
  { id: 'log', label: 'Log', kicker: 'Capture', icon: '++' },
  { id: 'dashboard', label: 'Dashboard', kicker: 'Signals', icon: '==' },
  { id: 'calendar', label: 'Calendar', kicker: 'Plan', icon: '[]' },
  { id: 'countdowns', label: 'Countdowns', kicker: 'Anticipate', icon: '>>' },
  { id: 'physique', label: 'Physique', kicker: 'Body lab', icon: '^^' },
  { id: 'goals', label: 'Goals', kicker: 'Outcomes', icon: '<>' },
  { id: 'areas', label: 'Life Areas', kicker: 'Balance', icon: '##' },
  { id: 'templates', label: 'Templates', kicker: 'Repeat', icon: '~~' },
  { id: 'metrics', label: 'Metrics', kicker: 'Signals', icon: '%%' },
  { id: 'wiki', label: 'Wiki', kicker: 'How-to', icon: '??' },
  { id: 'reviews', label: 'Reviews', kicker: 'Reflect', icon: '??' },
  { id: 'backup', label: 'Backup', kicker: 'Safety', icon: '!!' }
];

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
  const [activities, setActivities] = useState<Activity[]>([]);
  const [templates, setTemplates] = useState<ActivityTemplate[]>([]);
  const [recurrenceRules, setRecurrenceRules] = useState<RecurrenceRule[]>([]);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [countdowns, setCountdowns] = useState<Countdown[]>([]);
  const [physiqueEntries, setPhysiqueEntries] = useState<PhysiqueEntry[]>([]);
  const [wikiPages, setWikiPages] = useState<WikiPage[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [today, setToday] = useState<TodayDashboard | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [overview, setOverview] = useState<OverviewDashboard | null>(null);
  const [balance, setBalance] = useState<BalanceRow[]>([]);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => localStorage.getItem('axis-theme') === 'dark' ? 'dark' : 'light');

  async function load() {
    setIsLoading(true);
    try {
      setError('');
      const [lifeAreas, activeGoals, recentActivities, templateRows, recurrenceRows, metricRows, countdownRows, physiqueRows, wikiRows, reviewRows, todayData, suggestionRows, overviewData, balanceRows] = await Promise.all([
        api.get<LifeArea[]>('/api/life-areas'),
        api.get<Goal[]>('/api/goals'),
        api.get<Activity[]>('/api/activities'),
        api.get<ActivityTemplate[]>('/api/activity-templates'),
        api.get<RecurrenceRule[]>('/api/recurrence-rules'),
        api.get<Metric[]>('/api/metrics'),
        api.get<Countdown[]>('/api/countdowns'),
        api.get<PhysiqueEntry[]>('/api/physique'),
        api.get<WikiPage[]>('/api/wiki-pages'),
        api.get<Review[]>('/api/reviews'),
        api.get<TodayDashboard>('/api/dashboard/today'),
        api.get<Suggestion[]>('/api/dashboard/suggestions'),
        api.get<OverviewDashboard>('/api/dashboard'),
        api.get<BalanceRow[]>('/api/dashboard/balance')
      ]);

      setAreas(lifeAreas);
      setGoals(activeGoals);
      setActivities(recentActivities);
      setTemplates(templateRows);
      setRecurrenceRules(recurrenceRows);
      setMetrics(metricRows);
      setCountdowns(countdownRows);
      setPhysiqueEntries(physiqueRows);
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

  async function quickLogTemplate(template: ActivityTemplate) {
    const now = new Date();
    const existing = activities.find((activity) =>
      activity.templateId === template.id
      && activity.status === 'Planned'
      && sameDay(activity.plannedStartAt ?? activity.actualStartAt, now)
    );

    if (existing) {
      await api.post(`/api/activities/${existing.id}/complete`);
      await logCompanionMetric(template.title);
      return;
    }

    const start = new Date(now.getTime() - template.defaultDurationMinutes * 60000);
    await api.post('/api/activities', {
      lifeAreaId: template.lifeAreaId,
      goalId: findGoalIdForTemplate(template.title, goals),
      milestoneId: null,
      templateId: template.id,
      title: template.title,
      description: template.description,
      plannedStartAt: start.toISOString(),
      plannedEndAt: now.toISOString(),
      actualStartAt: start.toISOString(),
      actualEndAt: now.toISOString(),
      durationMinutes: template.defaultDurationMinutes,
      status: 'Completed',
      energyCost: template.energyCost,
      mentalLoad: template.mentalLoad,
      physicalLoad: template.physicalLoad,
      points: template.defaultPoints,
      notes: 'Quick logged from dashboard.'
    });
    await logCompanionMetric(template.title);
  }

  async function logCompanionMetric(templateTitle: string) {
    const metricMap: Record<string, { name: string; value: number; notes: string }> = {
      'Creatine dose': { name: 'Creatine dose', value: 5, notes: 'Quick logged default maintenance dose.' },
      'No alcohol check-in': { name: 'Alcohol drinks', value: 0, notes: 'Quick logged alcohol-free day.' },
      'No vape check-in': { name: 'Vape-free day', value: 1, notes: 'Quick logged vape-free day.' },
      'SPF 30+': { name: 'SPF 30+', value: 1, notes: 'Quick logged daily SPF.' }
    };
    const config = metricMap[templateTitle];
    const metric = config ? metrics.find((item) => item.name === config.name) : null;
    if (!metric || !config) {
      return;
    }

    await api.post(`/api/metrics/${metric.id}/entries`, {
      value: config.value,
      recordedAt: new Date().toISOString(),
      notes: config.notes
    });
  }

  async function deleteQuickLog(activity: Activity) {
    await api.delete(`/api/activities/${activity.id}`);

    const metricNameByTemplate: Record<string, string> = {
      'Creatine dose': 'Creatine dose',
      'No alcohol check-in': 'Alcohol drinks',
      'No vape check-in': 'Vape-free day'
    };
    const metric = metrics.find((item) => item.name === metricNameByTemplate[activity.title]);
    if (!metric) return;

    const entries = await api.get<MetricEntry[]>(`/api/metrics/${metric.id}/entries`);
    const activityTime = new Date(activity.actualEndAt ?? activity.plannedEndAt ?? getActivityDate(activity) ?? 0).getTime();
    const companionEntry = entries
      .filter((entry) => entry.notes.startsWith('Quick logged'))
      .map((entry) => ({ entry, distance: Math.abs(new Date(entry.recordedAt).getTime() - activityTime) }))
      .filter((candidate) => candidate.distance <= 10 * 60 * 1000)
      .sort((first, second) => first.distance - second.distance)[0]?.entry;
    if (companionEntry) {
      await api.delete(`/api/metrics/${metric.id}/entries/${companionEntry.id}`);
    }
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
          {pages.map((item) => (
            <VaporNavButton key={item.id} item={item} isActive={page === item.id} onSelect={() => setPage(item.id)} />
          ))}
        </nav>

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
            activities={activities}
            busy={isBusy}
            onComplete={(id) => runAction(() => api.post(`/api/activities/${id}/complete`), 'Activity completed.')}
            onSkip={(id) => runAction(() => api.post(`/api/activities/${id}/skip`), 'Activity skipped.')}
          />
        )}
        {page === 'dashboard' && (
          <DashboardPage
            activities={activities}
            templates={templates}
            goals={goals}
            metrics={metrics}
            busy={isBusy}
            onQuickLog={(template) => runAction(() => quickLogTemplate(template), `${template.title} logged.`)}
            onDeleteLog={(activity) => runAction(() => deleteQuickLog(activity), `${activity.title} log deleted.`)}
            onComplete={(id) => runAction(() => api.post(`/api/activities/${id}/complete`), 'Activity completed.')}
            onSkip={(id) => runAction(() => api.post(`/api/activities/${id}/skip`), 'Activity skipped.')}
          />
        )}
        {page === 'log' && (
          <LogPage
            templates={templates}
            activities={activities}
            goals={goals}
            busy={isBusy}
            onSave={(body, companion) => runAction(async () => {
              await api.post('/api/activities', body);
              if (companion) {
                const metric = metrics.find((item) => item.name === companion.name);
                if (metric) await api.post(`/api/metrics/${metric.id}/entries`, { value: companion.value, recordedAt: companion.recordedAt, notes: companion.notes });
              }
            }, 'Work logged.')}
          />
        )}
        {page === 'calendar' && (
          <CalendarPage
            areas={areas}
            goals={goals}
            activities={activities}
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
        {page === 'goals' && (
          <GoalsPage
            areas={areas}
            goals={goals}
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

function TodayPage(props: {
  today: TodayDashboard | null;
  suggestions: Suggestion[];
  overview: OverviewDashboard | null;
  balance: BalanceRow[];
  goals: Goal[];
  activities: Activity[];
  busy: boolean;
  onComplete: (id: string) => void;
  onSkip: (id: string) => void;
}) {
  const primary = props.today?.primaryGoal ?? props.goals.find((goal) => goal.priority === 'Primary');
  const plannedToday = props.today?.timeline ?? [];

  return (
    <section className="page-grid">
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
        <FocusPanel title="Main focus" activity={props.today?.mainFocus} busy={props.busy} onComplete={props.onComplete} onSkip={props.onSkip} />
        <FocusPanel title="Recovery" activity={props.today?.recoveryTask} busy={props.busy} onComplete={props.onComplete} onSkip={props.onSkip} />
      </section>

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

      <section className="surface">
        <SectionTitle kicker="Today" title="Timeline" />
        <ActivityList activities={plannedToday} busy={props.busy} onComplete={props.onComplete} onSkip={props.onSkip} />
      </section>

      <section className="surface">
        <SectionTitle kicker="Last 28 days" title="Life balance" />
        <LifeBalancePanel rows={props.balance} />
      </section>
    </section>
  );
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

function LogPage(props: { templates: ActivityTemplate[]; activities: Activity[]; goals: Goal[]; busy: boolean; onSave: (body: unknown, companion?: { name: string; value: number; recordedAt: string; notes: string }) => void }) {
  const activeTemplates = props.templates.filter((item) => item.isActive);
  const [templateId, setTemplateId] = useState(activeTemplates[0]?.id ?? '');
  const [quantity, setQuantity] = useState(1);
  const [duration, setDuration] = useState(activeTemplates[0]?.defaultDurationMinutes ?? 30);
  const [recordedAt, setRecordedAt] = useState(toLocalInput(new Date()));
  const [notes, setNotes] = useState('');
  const [muscles, setMuscles] = useState<string[]>([]);
  const template = activeTemplates.find((item) => item.id === templateId);
  const muscleOptions = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Core'];
  const recentMuscles = props.activities.filter((item) => item.status === 'Completed' && /Muscles:/i.test(item.notes) && new Date(getActivityDate(item) ?? 0) >= addDays(new Date(), -3));
  const recoveryHits = muscles.filter((muscle) => recentMuscles.some((item) => item.notes.includes(muscle)));
  const isSleep = template?.title === 'Sleep log';
  const isSpf = template?.title === 'SPF 30+';
  const sleepScore = quantity >= 8 ? { label: 'Optimal recovery', tone: 'good', copy: 'At or above the 8-hour target.' } : quantity >= 7 ? { label: 'Acceptable, not optimal', tone: 'okay', copy: 'A workable night, but some sleep debt may remain.' } : quantity >= 6 ? { label: 'Recovery compromised', tone: 'warning', copy: 'Training, attention, appetite, and appearance may suffer.' } : { label: 'Severe sleep deficit', tone: 'danger', copy: 'Prioritize recovery and avoid making this a pattern.' };

  function chooseTemplate(id: string) {
    const next = activeTemplates.find((item) => item.id === id);
    setTemplateId(id);
    if (next) setDuration(next.defaultDurationMinutes);
    if (next?.title === 'Sleep log') setQuantity(8);
    if (next?.title === 'SPF 30+') setQuantity(1);
    setMuscles([]);
  }

  return <section className="workspace-grid log-workspace">
    <div className="workspace-main">
      <section className="hero-panel"><div><p className="eyebrow">Universal capture</p><h3>Log what actually happened</h3><p>One place for habits, training, study volume, and meaningful work.</p></div></section>
      <section className="surface log-form-panel">
        <SectionTitle kicker="Completed work" title="New log" />
        <div className="template-picker">{activeTemplates.map((item) => <button key={item.id} className={templateId === item.id ? 'active' : ''} onClick={() => chooseTemplate(item.id)}>{item.title}<small>{item.lifeAreaName}</small></button>)}</div>
        <div className="form-grid three">
          {!isSpf && <NumberField label={isSleep ? 'Hours slept' : 'Quantity'} value={quantity} onChange={(value) => setQuantity(Math.max(isSleep ? 0 : 1, value))} />}
          <NumberField label="Total minutes" value={duration} onChange={(value) => setDuration(Math.max(1, value))} />
          <label className="field"><span>When</span><input type="datetime-local" value={recordedAt} onChange={(event) => setRecordedAt(event.target.value)} /></label>
        </div>
        {isSleep && <div className={`sleep-assessment ${sleepScore.tone}`}><strong>{quantity}h · {sleepScore.label}</strong><span>{sleepScore.copy} Axis uses 8h as the target, while 7h is the minimum acceptable zone for most adults.</span></div>}
        {template?.title === 'Hypertrophy workout' && <><div className="muscle-picker">{muscleOptions.map((muscle) => <button key={muscle} className={muscles.includes(muscle) ? 'active' : ''} onClick={() => setMuscles((current) => current.includes(muscle) ? current.filter((item) => item !== muscle) : [...current, muscle])}>{muscle}</button>)}</div>{recoveryHits.length > 0 && <div className="recovery-warning"><strong>Recovery check</strong><span>{recoveryHits.join(', ')} appeared in a workout during the last 72 hours. Consider another muscle group or a lighter session.</span></div>}</>}
        <TextArea label="Notes" value={notes} onChange={setNotes} />
        <button disabled={props.busy || !template} onClick={() => { if (!template) return; const end = new Date(recordedAt); const start = new Date(end.getTime() - duration * 60000); const body = { lifeAreaId: template.lifeAreaId, goalId: findGoalIdForTemplate(template.title, props.goals), milestoneId: null, templateId: template.id, title: template.title, description: template.description, plannedStartAt: start.toISOString(), plannedEndAt: end.toISOString(), actualStartAt: start.toISOString(), actualEndAt: end.toISOString(), durationMinutes: duration, status: 'Completed', energyCost: template.energyCost, mentalLoad: template.mentalLoad, physicalLoad: template.physicalLoad, points: template.defaultPoints * quantity, notes: [`Quantity: ${isSpf ? 1 : quantity}`, muscles.length ? `Muscles: ${muscles.join(', ')}` : '', notes].filter(Boolean).join(' · ') }; const companion = isSleep ? { name: 'Sleep duration', value: quantity, recordedAt: end.toISOString(), notes: sleepScore.label } : isSpf ? { name: 'SPF 30+', value: 1, recordedAt: end.toISOString(), notes: 'Daily SPF confirmed.' } : undefined; props.onSave(body, companion); }}>{isSpf ? 'Confirm SPF applied' : 'Log completed work'}</button>
      </section>
    </div>
    <aside className="editor-panel"><section className="surface"><SectionTitle kicker="Recovery" title="Recent muscle work" />{recentMuscles.slice(0, 8).map((item) => <div className="recent-log-row" key={item.id}><span><strong>{item.title}</strong><small>{formatDateTime(getActivityDate(item) ?? '')}</small></span></div>)}{recentMuscles.length === 0 && <EmptyState text="No muscle groups logged in the last 72 hours." />}</section></aside>
  </section>;
}

function DashboardPage(props: {
  activities: Activity[];
  templates: ActivityTemplate[];
  goals: Goal[];
  metrics: Metric[];
  busy: boolean;
  onQuickLog: (template: ActivityTemplate) => void;
  onDeleteLog: (activity: Activity) => void;
  onComplete: (id: string) => void;
  onSkip: (id: string) => void;
}) {
  const [rangeDays, setRangeDays] = useState(7);
  const [pendingTemplate, setPendingTemplate] = useState<ActivityTemplate | null>(null);
  const now = new Date();
  const rangeStart = startOfDay(addDays(now, -(rangeDays - 1)));
  const days = Array.from({ length: rangeDays }, (_, index) => addDays(rangeStart, index));
  const templateByTitle = new Map(props.templates.map((template) => [template.title, template]));
  const quickTemplates = [
    'Creatine dose',
    'Desk mobility reset',
    'Hypertrophy workout',
    'DSA problem rep',
    'System design case study',
    'No alcohol check-in',
    'No vape check-in',
    'Diet check-in',
    'Sleep log',
    'SPF 30+'
  ].map((title) => templateByTitle.get(title)).filter(Boolean) as ActivityTemplate[];
  const rangeActivities = props.activities.filter((activity) => {
    const date = getActivityDate(activity);
    return date && new Date(date) >= rangeStart && new Date(date) <= endOfDay(now);
  });
  const todayActivities = props.activities.filter((activity) => sameDay(getActivityDate(activity), now)).sort(compareActivities);
  const tracks = buildDashboardTracks(days, rangeActivities, quickTemplates);
  const completed = rangeActivities.filter((activity) => activity.status === 'Completed').length;
  const missed = tracks.reduce((sum, track) => sum + track.missedCount, 0);
  const studyMinutes = rangeActivities
    .filter((activity) => activity.status === 'Completed' && /DSA|System design/i.test(activity.title))
    .reduce((sum, activity) => sum + activity.durationMinutes, 0);
  const recentQuickLogs = props.activities
    .filter((activity) => activity.status === 'Completed' && quickTemplates.some((template) => template.id === activity.templateId))
    .sort((first, second) => new Date(getActivityDate(second) ?? 0).getTime() - new Date(getActivityDate(first) ?? 0).getTime())
    .slice(0, 8);

  return (
    <section className="page-grid">
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
                <div><dt>Minutes</dt><dd>{track.minutes}</dd></div>
              </dl>
              {track.template && track.title !== 'Sleep log' && <button className="secondary-button" disabled={props.busy} onClick={() => setPendingTemplate(track.template!)}>Log now</button>}
            </article>
          ))}
        </div>
      </section>

      <section className="surface momentum-chart-panel">
        <SectionTitle kicker="Visual trend" title="Momentum over time" />
        <DashboardMomentumChart days={days} tracks={tracks} goals={props.goals} metrics={props.metrics} activities={rangeActivities} />
      </section>

      <section className="work-grid two">
        <section className="surface">
          <SectionTitle kicker="Today" title="Quick log" />
          <div className="quick-log-grid">
            {quickTemplates.map((template) => (
              <button key={template.id} className="secondary-button quick-log-button" disabled={props.busy} onClick={() => setPendingTemplate(template)}>
                <strong>{template.title}</strong>
                <span>{template.defaultDurationMinutes}m · {template.lifeAreaName}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="surface">
          <SectionTitle kicker="History" title="Recent quick logs" />
          <div className="recent-log-list">
            {recentQuickLogs.map((activity) => (
              <div className="recent-log-row" key={activity.id}>
                <span><strong>{activity.title}</strong><small>{formatDateTime(getActivityDate(activity) ?? '')}</small></span>
                <button className="danger-button" disabled={props.busy} onClick={() => confirmDelete(`Delete the ${activity.title} log?`) && props.onDeleteLog(activity)}>Delete log</button>
              </div>
            ))}
            {recentQuickLogs.length === 0 && <EmptyState text="No quick logs yet." />}
          </div>
        </section>
      </section>

      {pendingTemplate && (
        <div className="confirmation-backdrop" role="presentation" onMouseDown={() => setPendingTemplate(null)}>
          <section className="confirmation-panel" role="dialog" aria-modal="true" aria-labelledby="quick-log-title" onMouseDown={(event) => event.stopPropagation()}>
            <p className="eyebrow">Confirm log</p>
            <h3 id="quick-log-title">Log {pendingTemplate.title} now?</h3>
            <p>This records {pendingTemplate.defaultDurationMinutes} minutes as completed today. You can delete it from Recent quick logs.</p>
            <div className="card-actions">
              <button className="secondary-button" onClick={() => setPendingTemplate(null)}>Cancel</button>
              <button disabled={props.busy} onClick={() => {
                props.onQuickLog(pendingTemplate);
                setPendingTemplate(null);
              }}>Confirm log</button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

function DashboardMomentumChart(props: { days: Date[]; tracks: DashboardTrack[]; goals: Goal[]; metrics: Metric[]; activities: Activity[] }) {
  const [mode, setMode] = useState<'overview' | 'goals' | 'metrics'>('overview');
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
  const timeRows = [...props.tracks]
    .filter((track) => track.minutes > 0)
    .sort((first, second) => second.minutes - first.minutes)
    .slice(0, 6);
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
      <div className="signal-summary-grid">
        <div className="signal-summary cyan"><span>Completion rate</span><strong>{completionRate}%</strong><i><b style={{ width: `${completionRate}%` }} /></i></div>
        <div className="signal-summary violet"><span>Current streak</span><strong>{currentStreak}d</strong><small>days with a completion</small></div>
        <div className="signal-summary pink"><span>Open gaps</span><strong>{totalMissed}</strong><small>across selected range</small></div>
        <div className="signal-summary amber"><span>Time invested</span><strong>{minutesToHours(totalMinutes)}h</strong><small>{completedLogs} completed logs</small></div>
      </div>

      <div className="momentum-visual-grid">
        <section className="signal-chart-card">
          <div className="signal-card-heading">
            <div><strong>Daily execution</strong><span>Activity count by day</span></div>
            <div className="chart-legend interactive">
              <button className={`done ${visibleSeries.done ? 'active' : ''}`} onClick={() => toggleSeries('done')}>Completed</button>
              <button className={`missed ${visibleSeries.missed ? 'active' : ''}`} onClick={() => toggleSeries('missed')}>Gaps</button>
              <button className={`planned ${visibleSeries.planned ? 'active' : ''}`} onClick={() => toggleSeries('planned')}>Planned</button>
            </div>
          </div>
          <div className="chart-frame">
            <div className="chart-scale"><span>{ceiling}</span><span>{roundNumber(ceiling / 2)}</span><span>0</span></div>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Completed, missed, and planned activities over the selected range">
              <line x1="0" y1="90" x2="100" y2="90" className="chart-axis" />
              {visibleSeries.planned && <polyline points={line('planned')} className="chart-line planned" />}
              {visibleSeries.missed && <polyline points={line('missed')} className="chart-line missed" />}
              {visibleSeries.done && <polyline points={line('done')} className="chart-line done" />}
              {points.map((point) => (
                <g key={dateKey(point.day)} className={`chart-day-hit ${selectedDayKey === dateKey(point.day) ? 'selected' : ''}`} onClick={() => setSelectedDayKey(dateKey(point.day))}>
                  <title>{`${point.day.toLocaleDateString()}: ${point.done} completed, ${point.missed} gaps, ${point.planned} planned`}</title>
                  <rect x={Math.max(0, point.x - Math.max(1.5, 45 / points.length))} y="0" width={Math.max(3, 90 / points.length)} height="94" className="chart-hit-zone" />
                  {selectedDayKey === dateKey(point.day) && <line x1={point.x} y1="0" x2={point.x} y2="94" className="chart-selection-line" />}
                  {visibleSeries.planned && <circle cx={point.x} cy={chartY(point.planned)} r="1.5" className="chart-point planned" />}
                  {visibleSeries.missed && <circle cx={point.x} cy={chartY(point.missed)} r="1.7" className="chart-point missed" />}
                  {visibleSeries.done && <circle cx={point.x} cy={chartY(point.done)} r="1.9" className="chart-point done" />}
                </g>
              ))}
            </svg>
          </div>
          <div className="chart-range"><span>{props.days[0]?.toLocaleDateString()}</span><span>{props.days.at(-1)?.toLocaleDateString()}</span></div>
          <div className="status-color-key">
            <span className="done"><i />Done</span>
            <span className="missed"><i />Missed or skipped</span>
            <span className="planned"><i />Still planned</span>
            <span className="empty"><i />Not scheduled</span>
          </div>
        </section>

        <section className="signal-chart-card allocation-card">
          <div className="signal-card-heading"><div><strong>Time allocation</strong><span>Where completed minutes went</span></div></div>
          <div className="allocation-list">
            {timeRows.map((track, index) => {
              const percentage = totalMinutes === 0 ? 0 : Math.round(track.minutes / totalMinutes * 100);
              return (
                <div className={`allocation-row signal-${index}`} key={track.title}>
                  <div><span><i />{track.title}</span><strong>{track.minutes}m</strong></div>
                  <b><i style={{ width: `${percentage}%` }} /></b>
                  <small>{percentage}% of tracked time</small>
                </div>
              );
            })}
            {timeRows.length === 0 && <EmptyState text="Complete an activity to reveal time allocation." />}
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
  const [view, setView] = useState<CalendarView>('week');
  const [anchorDate, setAnchorDate] = useState(() => startOfDay(new Date()));
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [areaFilter, setAreaFilter] = useState('');
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
    <section className="workspace-grid">
      <div className="workspace-main">
        <section className="calendar-surface">
          <div className="calendar-toolbar">
            <div>
              <p className="eyebrow">Planner</p>
              <h3>{rangeLabel}</h3>
            </div>
            <div className="calendar-controls">
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
              onOpen={setSelected}
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
          <SectionTitle kicker={view === 'month' ? 'Selected month' : 'Visible range'} title="Agenda" />
          <ActivityList
            activities={filteredActivities}
            busy={props.busy}
            onComplete={props.onComplete}
            onSkip={props.onSkip}
            onEdit={setSelected}
            onDelete={(id) => confirmDelete('Delete this activity?') && props.onDelete(id)}
          />
        </section>
      </div>

      <aside className="editor-panel">
        <ActivityForm
          key={`${selected?.id || 'new-activity'}-${selected?.plannedStartAt ?? ''}`}
          activity={selected}
          areas={props.areas}
          goals={props.goals}
          busy={props.busy}
          onCancel={() => setSelected(null)}
          onSave={(body) => {
            props.onSave(body, selected?.id || undefined);
            setSelected(null);
          }}
        />
      </aside>
    </section>
  );
}

function TimeGridCalendar(props: {
  days: Date[];
  activities: Activity[];
  onOpen: (activity: Activity) => void;
  onCreate: (day: Date, hour: number) => void;
}) {
  const hours = Array.from({ length: 18 }, (_, index) => index + 6);

  return (
    <div className="time-calendar">
      <div className="time-header" style={{ gridTemplateColumns: `72px repeat(${props.days.length}, minmax(150px, 1fr))` }}>
        <span />
        {props.days.map((day) => (
          <button className={isToday(day) ? 'time-day-heading today' : 'time-day-heading'} key={dateKey(day)} onClick={() => props.onCreate(day, 9)}>
            <span>{day.toLocaleDateString(undefined, { weekday: 'short' })}</span>
            <strong>{day.getDate()}</strong>
          </button>
        ))}
      </div>
      <div className="time-body" style={{ gridTemplateColumns: `72px repeat(${props.days.length}, minmax(150px, 1fr))` }}>
        <div className="time-axis">
          {hours.map((hour) => <span key={hour}>{formatHour(hour)}</span>)}
        </div>
        {props.days.map((day) => (
          <div className="time-column" key={dateKey(day)}>
            {hours.map((hour) => (
              <button className="time-slot" key={hour} onClick={() => props.onCreate(day, hour)} aria-label={`Create activity at ${formatHour(hour)}`} />
            ))}
            {props.activities.filter((activity) => sameDay(getActivityDate(activity), day)).map((activity) => (
              <button
                className="calendar-event"
                key={activity.id}
                style={{ ...eventStyle(activity), borderColor: activity.lifeAreaColor }}
                data-status={activity.status.toLowerCase()}
                onClick={() => props.onOpen(activity)}
              >
                <strong>{activity.title}</strong>
                <span>{formatTime(getActivityDate(activity))} · {activity.durationMinutes}m</span>
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
  const sorted = [...props.activities].sort(compareActivities);
  const planned = sorted.filter((activity) => activity.status === 'Planned').length;
  const completed = sorted.filter((activity) => activity.status === 'Completed').length;
  const skipped = sorted.filter((activity) => activity.status === 'Skipped').length;

  return (
    <div className="calendar-review">
      <div className="review-summary">
        <div>
          <p className="eyebrow">Check-off flow</p>
          <h4>{props.title}</h4>
        </div>
        <div className="review-stats">
          <SummaryPill label="Planned" value={planned} />
          <SummaryPill label="Done" value={completed} />
          <SummaryPill label="Skipped" value={skipped} />
        </div>
      </div>
      <div className="review-list">
        {sorted.map((activity) => (
          <div className="review-row" key={activity.id}>
            <i style={{ background: activity.lifeAreaColor }} />
            <button className="review-title" onClick={() => props.onOpen(activity)}>
              <strong>{activity.title}</strong>
              <span>{formatShortDate(getActivityDate(activity))} · {formatTime(getActivityDate(activity))} · {activity.lifeAreaName}</span>
            </button>
            <span className={`status-badge ${activity.status.toLowerCase()}`}>{activity.status}</span>
            <div className="row-actions">
              <button className="secondary-button" disabled={props.busy || activity.status === 'Completed'} onClick={() => props.onComplete(activity.id)}>Done</button>
              <button className="secondary-button" disabled={props.busy || activity.status === 'Skipped'} onClick={() => props.onSkip(activity.id)}>Skip</button>
            </div>
          </div>
        ))}
        {sorted.length === 0 && <EmptyState text="Click a day or hour slot to plan the first activity in this range." />}
      </div>
    </div>
  );
}

function CountdownsPage(props: {
  countdowns: Countdown[];
  busy: boolean;
  onSave: (countdown: unknown, id?: string) => void;
  onDelete: (id: string) => void;
}) {
  const [selected, setSelected] = useState<Countdown | null>(null);
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
    <section className="workspace-grid">
      <div className="workspace-main">
        <section className="collection-header">
          <div>
            <p className="eyebrow">Release radar</p>
            <h3>{props.countdowns.length} countdowns</h3>
          </div>
          <button onClick={() => setSelected(null)}>New countdown</button>
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
            <article className={countdown.isPast ? 'entity-card countdown-card elapsed' : 'entity-card countdown-card'} key={countdown.id}>
              <div className="entity-card-top">
                <strong>{countdown.title}</strong>
                <span>{countdown.category || 'Countdown'}</span>
              </div>
              <div className="countdown-clock" style={{ borderColor: countdown.color }}>
                <strong>{countdown.isPast ? 'Released' : countdown.daysRemaining}</strong>
                <span>{countdown.isPast ? 'target passed' : `days ${countdown.hoursRemaining}h ${countdown.minutesRemaining}m`}</span>
              </div>
              <p>{countdown.description || 'No notes yet.'}</p>
              <dl className="compact-dl">
                <div><dt>Target</dt><dd>{formatDateTime(countdown.targetAt)}</dd></div>
                <div><dt>Pinned</dt><dd>{countdown.isPinned ? 'Yes' : 'No'}</dd></div>
                <div><dt>Status</dt><dd>{countdown.isArchived ? 'Archived' : 'Active'}</dd></div>
              </dl>
              <div className="card-actions">
                <button className="secondary-button" onClick={() => setSelected(countdown)}>Edit</button>
                <button className="danger-button" onClick={() => confirmDelete('Delete this countdown?') && props.onDelete(countdown.id)}>Delete</button>
              </div>
            </article>
          ))}
          {filtered.length === 0 && <EmptyState text="No countdowns match the current filters." />}
        </div>
        <PaginationControls page={page} totalPages={paged.totalPages} totalItems={filtered.length} onPage={setPage} />
      </div>

      <aside className="editor-panel">
        <CountdownForm
          key={selected?.id ?? 'new-countdown'}
          countdown={selected}
          busy={props.busy}
          onSave={(body) => {
            props.onSave(body, selected?.id);
            setSelected(null);
          }}
          onCancel={() => setSelected(null)}
        />
      </aside>
    </section>
  );
}

function PhysiquePage(props: {
  entries: PhysiqueEntry[];
  busy: boolean;
  onSave: (entry: unknown, id?: string) => void;
  onDelete: (id: string) => void;
}) {
  const [selected, setSelected] = useState<PhysiqueEntry | null>(null);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const latest = props.entries[0];
  const filtered = props.entries.filter((entry) => {
    const text = `${entry.status} ${entry.notes} ${entry.weightKg} ${entry.estimatedBodyFatPercent ?? ''}`.toLowerCase();
    return !query || text.includes(query.toLowerCase());
  });
  const paged = paginate(filtered, page, defaultPageSize);

  useEffect(() => {
    setPage(1);
  }, [query]);

  return (
    <section className="workspace-grid">
      <div className="workspace-main">
        <section className="hero-panel physique-hero">
          <div>
            <p className="eyebrow">Current physique</p>
            <h3>{latest ? `${latest.weightKg} kg${latest.estimatedBodyFatPercent ? ` · ${latest.estimatedBodyFatPercent}% body fat` : ''}` : 'No body log yet'}</h3>
            <p>{latest?.status || 'Track weight, waist, neck, mood, and status to see body-composition direction.'}</p>
          </div>
          <PhysiqueDiagram entry={latest} entries={props.entries} />
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
                <button className="secondary-button" onClick={() => setSelected(entry)}>Edit</button>
                <button className="danger-button" onClick={() => confirmDelete('Delete this physique entry?') && props.onDelete(entry.id)}>Delete</button>
              </div>
            </article>
          ))}
          {filtered.length === 0 && <EmptyState text="No physique entries match the current filters." />}
        </div>
        <PaginationControls page={page} totalPages={paged.totalPages} totalItems={filtered.length} onPage={setPage} />
      </div>

      <aside className="editor-panel">
        <PhysiqueEntryForm
          key={selected?.id ?? `new-physique-${latest?.id ?? 'empty'}`}
          entry={selected}
          baseline={latest ?? null}
          busy={props.busy}
          onSave={(body) => {
            props.onSave(body, selected?.id);
            setSelected(null);
          }}
          onCancel={() => setSelected(null)}
        />
      </aside>
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
  activities: Activity[];
  metrics: Metric[];
  busy: boolean;
  onSave: (goal: unknown, id?: string) => void;
  onMilestoneSave: (goalId: string, milestone: unknown, id?: string) => void;
  onMilestoneDelete: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [selected, setSelected] = useState<Goal | null>(null);
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
    <section className="workspace-grid">
      <div className="workspace-main">
        <section className="collection-header">
          <div>
            <p className="eyebrow">Active pressure</p>
            <h3>{activeGoals.length} active goals</h3>
          </div>
          <button onClick={() => {
            setSelected(null);
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
          {pagedGoals.items.map((goal) => (
            <article
              className="entity-card goal-card"
              key={goal.id}
              role="button"
              tabIndex={0}
              onClick={() => {
                setInspectedGoal(goal);
                setSelected(null);
                setSelectedMilestone(null);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setInspectedGoal(goal);
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
              <div className="meter"><i style={{ width: `${goal.currentValue}%`, background: goal.lifeAreaColor }} /></div>
              <div className="goal-health-row">
                <span className={`status-badge ${getGoalHealth(goal).toLowerCase()}`}>{getGoalHealth(goal)}</span>
                <small>{goal.progressType} · decay {goal.decayRatePercentPerWeek}%/week</small>
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
                  setSelected(goal);
                  setSelectedMilestone(null);
                }}>Edit</button>
                <button className="secondary-button" onClick={(event) => {
                  event.stopPropagation();
                  setInspectedGoal(null);
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
          ))}
        </div>
        <PaginationControls page={page} totalPages={pagedGoals.totalPages} totalItems={filteredGoals.length} onPage={setPage} />
      </div>

      <aside className="editor-panel">
        {inspectedGoal && !selected && !selectedMilestone && (
          <GoalInsightPanel
            goal={inspectedGoal}
            activities={props.activities}
            metrics={props.metrics}
            onClose={() => setInspectedGoal(null)}
          />
        )}
        <GoalForm
          key={selected?.id ?? 'new-goal'}
          goal={selected}
          areas={props.areas}
          busy={props.busy}
          onSave={(body) => {
            props.onSave(body, selected?.id);
            setSelected(null);
            setInspectedGoal(null);
            setSelectedMilestone(null);
          }}
          onCancel={() => {
            setSelected(null);
            setSelectedMilestone(null);
          }}
        />
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
      </aside>
    </section>
  );
}

function GoalInsightPanel(props: { goal: Goal; activities: Activity[]; metrics: Metric[]; onClose: () => void }) {
  const goalActivities = props.activities.filter((activity) => activity.goalId === props.goal.id);
  const completed = goalActivities.filter((activity) => activity.status === 'Completed');
  const skipped = goalActivities.filter((activity) => activity.status === 'Skipped' || activity.status === 'Cancelled');
  const minutes = completed.reduce((sum, activity) => sum + activity.durationMinutes, 0);
  const lastDone = completed
    .map((activity) => getActivityDate(activity))
    .filter(Boolean)
    .sort()
    .at(-1);
  const recentDays = Array.from({ length: 30 }, (_, index) => addDays(new Date(), index - 29));
  const goalMetrics = props.metrics.filter((metric) => metric.goalId === props.goal.id);
  const isFlexibleStudyGoal = /dsa|system design/i.test(props.goal.title);

  return (
    <section className="goal-detail-panel">
      <div className="goal-detail-top">
        <SectionTitle kicker={props.goal.lifeAreaName} title={props.goal.title} />
        <button className="secondary-button icon-button" onClick={props.onClose} aria-label="Close goal details">x</button>
      </div>
      <div className="meter"><i style={{ width: `${props.goal.currentValue}%`, background: props.goal.lifeAreaColor }} /></div>
      <dl className="compact-dl">
        <div><dt>Progress</dt><dd>{props.goal.currentValue}%</dd></div>
        <div><dt>Done</dt><dd>{completed.length}</dd></div>
        <div><dt>Skipped</dt><dd>{skipped.length}</dd></div>
        <div><dt>Minutes</dt><dd>{minutes}</dd></div>
        <div><dt>Last done</dt><dd>{lastDone ? formatShortDate(lastDone) : 'No log'}</dd></div>
        <div><dt>Weekly target</dt><dd>{props.goal.maintenanceTargetPerWeek ?? 'Flexible'}</dd></div>
      </dl>
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
    <section className="workspace-grid">
      <div className="workspace-main">
        <section className="collection-header">
          <div>
            <p className="eyebrow">Attention architecture</p>
            <h3>{props.areas.length} life areas</h3>
          </div>
          <button onClick={() => setSelected(null)}>New life area</button>
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
                <button className="secondary-button" onClick={() => setSelected(area)}>Edit</button>
                <button className="danger-button" onClick={() => confirmDelete('Delete this life area? Linked data may also be removed.') && props.onDelete(area.id)}>Delete</button>
              </div>
            </article>
          ))}
          {filteredAreas.length === 0 && <EmptyState text="No life areas match the current filters." />}
        </div>
        <PaginationControls page={page} totalPages={pagedAreas.totalPages} totalItems={filteredAreas.length} onPage={setPage} />
      </div>

      <aside className="editor-panel">
        <LifeAreaForm
          key={selected?.id ?? 'new-area'}
          area={selected}
          busy={props.busy}
          onSave={(body) => {
            props.onSave(body, selected?.id);
            setSelected(null);
          }}
          onCancel={() => setSelected(null)}
        />
      </aside>
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
    <section className="workspace-grid">
      <div className="workspace-main">
        <section className="collection-header">
          <div>
            <p className="eyebrow">Reusable planning</p>
            <h3>{props.templates.length} templates</h3>
          </div>
          <button onClick={() => {
            setSelected(null);
            setSelectedRule(null);
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
                    setSelected(template);
                    setSelectedRule(null);
                  }}>Edit</button>
                  <button className="secondary-button" onClick={() => {
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

      <aside className="editor-panel">
        <TemplateForm
          key={selected?.id ?? 'new-template'}
          template={selected}
          areas={props.areas}
          busy={props.busy}
          onSave={(body) => {
            props.onSave(body, selected?.id);
            setSelected(null);
          }}
          onCancel={() => setSelected(null)}
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
            }}
            onDelete={selectedRule ? () => {
              if (confirmDelete('Delete this recurrence rule?')) {
                props.onRuleDelete(selectedRule.id);
                setSelectedRule(null);
              }
            } : undefined}
            onCancel={() => setSelectedRule(null)}
          />
        )}
      </aside>
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
  const [historyMetric, setHistoryMetric] = useState<Metric | null>(null);
  const [historyRange, setHistoryRange] = useState('90');
  const [query, setQuery] = useState('');
  const [areaFilter, setAreaFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [historyEntries, setHistoryEntries] = useState<MetricEntry[]>([]);
  const [historyError, setHistoryError] = useState('');
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [entryValues, setEntryValues] = useState<Record<string, string>>({});
  const [entryNotes, setEntryNotes] = useState<Record<string, string>>({});

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
      recordedAt: new Date().toISOString(),
      notes: entryNotes[metric.id] ?? ''
    });
    setEntryValues({ ...entryValues, [metric.id]: '' });
    setEntryNotes({ ...entryNotes, [metric.id]: '' });
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
    setPage(1);
  }, [query, areaFilter, typeFilter]);

  return (
    <section className="workspace-grid">
      <div className="workspace-main">
        <section className="collection-header">
          <div>
            <p className="eyebrow">Measured signals</p>
            <h3>{props.metrics.length} metrics</h3>
          </div>
          <button onClick={() => setSelected(null)}>New metric</button>
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

        <div className="entity-grid">
          {pagedMetrics.items.map((metric) => (
            <article className="entity-card" key={metric.id}>
              <div className="entity-card-top">
                <strong>{metric.name}</strong>
                <span>{metric.valueType}</span>
              </div>
              <p className="large-value">{metric.latestEntry ? `${metric.latestEntry.value} ${metric.unit}` : 'No entries'}</p>
              <MetricSparkline entries={metric.latestEntry ? [metric.latestEntry] : []} targetValue={metric.targetValue} />
              <TargetComparison metric={metric} />
              <form className="mini-form metric-log-form" onSubmit={(event) => {
                event.preventDefault();
                void logEntry(metric);
              }}>
                <input type="number" value={entryValues[metric.id] ?? ''} onChange={(event) => setEntryValues({ ...entryValues, [metric.id]: event.target.value })} placeholder="Value" />
                <input value={entryNotes[metric.id] ?? ''} onChange={(event) => setEntryNotes({ ...entryNotes, [metric.id]: event.target.value })} placeholder="Note" />
                <button type="submit" disabled={props.busy}>Log</button>
              </form>
              <div className="card-actions">
                <button className="secondary-button" onClick={() => setHistoryMetric(metric)}>History</button>
                <button className="secondary-button" onClick={() => setSelected(metric)}>Edit</button>
                <button className="danger-button" onClick={() => confirmDelete('Delete this metric?') && props.onDelete(metric.id)}>Delete</button>
              </div>
            </article>
          ))}
        </div>
        <PaginationControls page={page} totalPages={pagedMetrics.totalPages} totalItems={filteredMetrics.length} onPage={setPage} />
      </div>

      <aside className="editor-panel">
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
        <MetricForm
          key={selected?.id ?? 'new-metric'}
          metric={selected}
          areas={props.areas}
          goals={props.goals}
          busy={props.busy}
          onSave={(body) => {
            props.onSave(body, selected?.id);
            setSelected(null);
          }}
          onCancel={() => setSelected(null)}
        />
      </aside>
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
  const sorted = [...props.entries].sort((first, second) => new Date(first.recordedAt).getTime() - new Date(second.recordedAt).getTime());
  const latest = sorted.at(-1);
  const previous = sorted.at(-2);
  const delta = latest && previous ? latest.value - previous.value : null;
  const average = sorted.length ? sorted.reduce((sum, entry) => sum + entry.value, 0) / sorted.length : null;

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

        <MetricSparkline entries={sorted} targetValue={props.metric.targetValue} large />

        <dl className="compact-dl">
          <div><dt>Latest</dt><dd>{latest ? `${latest.value} ${props.metric.unit}` : 'None'}</dd></div>
          <div><dt>Delta</dt><dd>{delta === null ? 'None' : `${delta > 0 ? '+' : ''}${roundNumber(delta)} ${props.metric.unit}`}</dd></div>
          <div><dt>Average</dt><dd>{average === null ? 'None' : `${roundNumber(average)} ${props.metric.unit}`}</dd></div>
        </dl>

        {props.isLoading && <EmptyState text="Loading metric history..." />}
        {props.error && <div className="notice error">{props.error}</div>}

        <div className="metric-entry-table">
          {props.entries.map((entry) => (
            <div className="metric-entry-row" key={entry.id}>
              <div>
                <strong>{entry.value} {props.metric.unit}</strong>
                <span>{formatDateTime(entry.recordedAt)}</span>
                {entry.notes && <p>{entry.notes}</p>}
              </div>
              <button className="danger-button" onClick={() => props.onDeleteEntry(entry)}>Delete</button>
            </div>
          ))}
          {!props.isLoading && props.entries.length === 0 && <EmptyState text="No entries in this range yet." />}
        </div>
      </div>
    </EditorShell>
  );
}

function MetricSparkline(props: { entries: MetricEntry[]; targetValue?: number | null; large?: boolean }) {
  const path = buildSparklinePath(props.entries);
  const targetY = props.targetValue == null ? null : getSparklineY(props.entries, props.targetValue);

  return (
    <div className={props.large ? 'sparkline large' : 'sparkline'}>
      <svg viewBox="0 0 220 72" role="img" aria-label="Metric trend">
        {targetY !== null && <line x1="0" x2="220" y1={targetY} y2={targetY} className="sparkline-target" />}
        {path ? <path d={path} /> : <line x1="0" x2="220" y1="58" y2="58" className="sparkline-empty" />}
      </svg>
    </div>
  );
}

function TargetComparison({ metric }: { metric: Metric }) {
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

function ReviewsPage(props: { reviews: Review[]; busy: boolean; onGenerate: () => void; onGenerateMonthly: () => void; onSave: (id: string, body: unknown) => void; onDelete: (id: string) => void }) {
  const [selected, setSelected] = useState<Review | null>(null);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const filteredReviews = props.reviews.filter((review) => {
    const text = `${review.summary} ${review.whatWorked} ${review.whatDidNotWork} ${review.nextFocus}`.toLowerCase();
    return (!query || text.includes(query.toLowerCase())) && (!typeFilter || review.type === typeFilter);
  });
  const pagedReviews = paginate(filteredReviews, page, defaultPageSize);

  useEffect(() => {
    setPage(1);
  }, [query, typeFilter]);

  return (
    <section className="workspace-grid">
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

      <aside className="editor-panel">
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
      </aside>
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
          <NumberField label="Decay %/week" value={draft.decayRatePercentPerWeek} onChange={(decayRatePercentPerWeek) => setDraft({ ...draft, decayRatePercentPerWeek })} />
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

function ActivityForm(props: { activity: Activity | null; areas: LifeArea[]; goals: Goal[]; busy: boolean; onSave: (body: unknown) => void; onCancel: () => void }) {
  const isExisting = Boolean(props.activity?.id);
  const selectedGoal = props.goals.find((goal) => goal.id === props.activity?.goalId);
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
    notes: props.activity?.notes ?? ''
  });
  const availableMilestones = props.goals.find((goal) => goal.id === draft.goalId)?.milestones ?? selectedGoal?.milestones ?? [];

  return (
    <EditorShell title={isExisting ? 'Edit activity' : 'Plan activity'} onCancel={props.onCancel}>
      <form className="editor-form" onSubmit={(event) => {
        event.preventDefault();
        const start = new Date(draft.plannedStartAt);
        const end = new Date(start.getTime() + Number(draft.durationMinutes) * 60000);
        props.onSave({
          ...draft,
          goalId: draft.goalId || null,
          plannedStartAt: start.toISOString(),
          plannedEndAt: end.toISOString(),
          actualStartAt: props.activity?.actualStartAt ?? null,
          actualEndAt: props.activity?.actualEndAt ?? null
        });
      }}>
        <TextField label="Title" value={draft.title} onChange={(title) => setDraft({ ...draft, title })} required />
        <TextArea label="Description" value={draft.description} onChange={(description) => setDraft({ ...draft, description })} />
        <SelectField label="Life area" value={draft.lifeAreaId} onChange={(lifeAreaId) => setDraft({ ...draft, lifeAreaId })} options={props.areas.map((area) => ({ value: area.id, label: area.name }))} />
        <SelectField label="Goal" value={draft.goalId} onChange={(goalId) => setDraft({ ...draft, goalId, milestoneId: null })} options={[{ value: '', label: 'No goal' }, ...props.goals.map((goal) => ({ value: goal.id, label: goal.title }))]} />
        <SelectField label="Milestone" value={draft.milestoneId ?? ''} onChange={(milestoneId) => setDraft({ ...draft, milestoneId: milestoneId || null })} options={[{ value: '', label: 'No milestone' }, ...availableMilestones.map((milestone) => ({ value: milestone.id, label: milestone.title }))]} />
        <div className="form-grid two">
          <label className="field"><span>Start</span><input type="datetime-local" value={draft.plannedStartAt} onChange={(event) => setDraft({ ...draft, plannedStartAt: event.target.value })} /></label>
          <NumberField label="Minutes" value={draft.durationMinutes} onChange={(durationMinutes) => setDraft({ ...draft, durationMinutes })} />
        </div>
        <div className="form-grid two">
          <SelectField label="Status" value={draft.status} onChange={(status) => setDraft({ ...draft, status: status as ActivityStatus })} options={activityStatuses.map(toOption)} />
          <NumberField label="Points" value={draft.points} onChange={(points) => setDraft({ ...draft, points })} />
        </div>
        <div className="form-grid three">
          <SelectField label="Energy" value={draft.energyCost} onChange={(energyCost) => setDraft({ ...draft, energyCost: energyCost as LoadLevel })} options={loadLevels.map(toOption)} />
          <SelectField label="Mental" value={draft.mentalLoad} onChange={(mentalLoad) => setDraft({ ...draft, mentalLoad: mentalLoad as LoadLevel })} options={loadLevels.map(toOption)} />
          <SelectField label="Physical" value={draft.physicalLoad} onChange={(physicalLoad) => setDraft({ ...draft, physicalLoad: physicalLoad as LoadLevel })} options={loadLevels.map(toOption)} />
        </div>
        <TextArea label="Notes" value={draft.notes} onChange={(notes) => setDraft({ ...draft, notes })} />
        <button disabled={props.busy}>{isExisting ? 'Save changes' : 'Plan activity'}</button>
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

function FocusPanel(props: { title: string; activity?: Activity; busy: boolean; onComplete: (id: string) => void; onSkip: (id: string) => void }) {
  return (
    <article className="surface focus-panel">
      <SectionTitle kicker="Today" title={props.title} />
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
  return (
    <div className="activity-row">
      <span className="activity-marker" style={{ background: props.activity.lifeAreaColor }} />
      <div>
        <strong>{props.activity.title}</strong>
        <p>{props.activity.lifeAreaName} · {props.activity.durationMinutes}m · {props.activity.status}</p>
      </div>
      <div className="row-actions">
        {props.activity.status === 'Planned' && <button disabled={props.busy} onClick={() => props.onComplete(props.activity.id)}>Done</button>}
        {props.activity.status === 'Planned' && <button className="secondary-button" disabled={props.busy} onClick={() => props.onSkip(props.activity.id)}>Skip</button>}
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
          <label className="field"><span>Recorded at</span><input type="datetime-local" value={draft.recordedAt} onChange={(event) => setDraft({ ...draft, recordedAt: event.target.value })} /></label>
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
  return activity.plannedStartAt ?? activity.actualStartAt;
}

function findGoalIdForTemplate(templateTitle: string, goals: Goal[]) {
  const exactMap: Record<string, string> = {
    'Creatine dose': 'Creatine saturation and maintenance',
    'Desk mobility reset': 'Desk mobility and flexibility',
    'Hypertrophy workout': 'Lean muscle recomposition',
    'No alcohol check-in': 'Alcohol-free baseline',
    'No vape check-in': 'Vape-free baseline',
    'Diet check-in': 'Diet adherence and lean body composition',
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
