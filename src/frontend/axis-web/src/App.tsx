import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api } from './api';
import type { Activity, BalanceRow, Goal, LifeArea, Metric, OverviewDashboard, Review, TodayDashboard } from './types';

type Page = 'today' | 'calendar' | 'goals' | 'areas' | 'metrics' | 'reviews' | 'backup';
type Theme = 'light' | 'dark';

const pages: Array<{ id: Page; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'goals', label: 'Goals' },
  { id: 'areas', label: 'Life Areas' },
  { id: 'metrics', label: 'Metrics' },
  { id: 'reviews', label: 'Reviews' },
  { id: 'backup', label: 'Backup' }
];

const colors = ['#3b82f6', '#16a34a', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#64748b'];

export default function App() {
  const [page, setPage] = useState<Page>('today');
  const [areas, setAreas] = useState<LifeArea[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [today, setToday] = useState<TodayDashboard | null>(null);
  const [overview, setOverview] = useState<OverviewDashboard | null>(null);
  const [balance, setBalance] = useState<BalanceRow[]>([]);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [theme, setTheme] = useState<Theme>(() => localStorage.getItem('axis-theme') === 'dark' ? 'dark' : 'light');

  async function load() {
    try {
      setError('');
      const [lifeAreas, activeGoals, recentActivities, metricRows, reviewRows, todayData, overviewData, balanceRows] = await Promise.all([
        api.get<LifeArea[]>('/api/life-areas'),
        api.get<Goal[]>('/api/goals'),
        api.get<Activity[]>('/api/activities'),
        api.get<Metric[]>('/api/metrics'),
        api.get<Review[]>('/api/reviews'),
        api.get<TodayDashboard>('/api/dashboard/today'),
        api.get<OverviewDashboard>('/api/dashboard'),
        api.get<BalanceRow[]>('/api/dashboard/balance')
      ]);

      setAreas(lifeAreas);
      setGoals(activeGoals);
      setActivities(recentActivities);
      setMetrics(metricRows);
      setReviews(reviewRows);
      setToday(todayData);
      setOverview(overviewData);
      setBalance(balanceRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load Axis data.');
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
    try {
      setError('');
      await action();
      setNotice(message);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed.');
    }
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">Local-first</p>
          <h1>Axis</h1>
          <p className="sidebar-copy">Realistic goals, calm planning, honest progress.</p>
        </div>
        <div className="sidebar-bottom">
          <nav>
            {pages.map((item) => (
              <button key={item.id} className={page === item.id ? 'active' : ''} onClick={() => setPage(item.id)}>
                {item.label}
              </button>
            ))}
          </nav>
          <button className="theme-toggle secondary" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
        </div>
      </aside>

      <main className="content">
        {(notice || error) && (
          <div className={error ? 'banner error' : 'banner'}>{error || notice}</div>
        )}

        {page === 'today' && (
          <TodayPage
            today={today}
            overview={overview}
            balance={balance}
            onComplete={(id) => runAction(() => api.post(`/api/activities/${id}/complete`), 'Activity completed.')}
            onSkip={(id) => runAction(() => api.post(`/api/activities/${id}/skip`), 'Activity moved out of pressure.')}
          />
        )}
        {page === 'calendar' && <CalendarPage areas={areas} goals={goals} activities={activities} onCreate={(body) => runAction(() => api.post('/api/activities', body), 'Activity planned.')} />}
        {page === 'goals' && <GoalsPage areas={areas} goals={goals} onCreate={(body) => runAction(() => api.post('/api/goals', body), 'Goal created.')} />}
        {page === 'areas' && <AreasPage areas={areas} onCreate={(body) => runAction(() => api.post('/api/life-areas', body), 'Life area created.')} />}
        {page === 'metrics' && <MetricsPage areas={areas} metrics={metrics} onCreate={(body) => runAction(() => api.post('/api/metrics', body), 'Metric created.')} onEntry={(id, body) => runAction(() => api.post(`/api/metrics/${id}/entries`, body), 'Metric logged.')} />}
        {page === 'reviews' && <ReviewsPage reviews={reviews} onGenerate={() => runAction(() => api.post('/api/reviews/weekly/generate'), 'Weekly review generated.')} />}
        {page === 'backup' && <BackupPage onExport={() => runAction(async () => setNotice(`Backup created: ${(await api.exportBackup()).fileName}`), 'Backup created.')} />}
      </main>
    </div>
  );
}

function TodayPage({ today, overview, balance, onComplete, onSkip }: {
  today: TodayDashboard | null;
  overview: OverviewDashboard | null;
  balance: BalanceRow[];
  onComplete: (id: string) => void;
  onSkip: (id: string) => void;
}) {
  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Today</p>
          <h2>{today?.suggestion ?? 'Choose one useful next action.'}</h2>
        </div>
        <div className="stats">
          <Stat label="Active goals" value={overview?.activeGoals ?? 0} />
          <Stat label="Done this week" value={overview?.completedThisWeek ?? 0} />
        </div>
      </header>

      <div className="focus-grid">
        <FocusBlock title="Main focus" activity={today?.mainFocus} onComplete={onComplete} onSkip={onSkip} />
        <FocusBlock title="Recovery" activity={today?.recoveryTask} onComplete={onComplete} onSkip={onSkip} />
      </div>

      <section className="panel">
        <h3>Timeline</h3>
        <div className="activity-list">
          {(today?.timeline ?? []).map((activity) => (
            <ActivityRow key={activity.id} activity={activity} onComplete={onComplete} onSkip={onSkip} />
          ))}
          {today?.timeline.length === 0 && <p className="empty">No plan yet. Add one focused activity in Calendar.</p>}
        </div>
      </section>

      <section className="panel">
        <h3>Life balance, last 28 days</h3>
        <div className="balance-bars">
          {balance.map((row) => (
            <div key={row.lifeAreaId} className="balance-row">
              <span>{row.name}</span>
              <div className="bar"><i style={{ width: `${row.percent}%`, background: row.color }} /></div>
              <strong>{row.hours}h</strong>
            </div>
          ))}
          {balance.length === 0 && <p className="empty">Complete activities to build your attention map.</p>}
        </div>
      </section>
    </section>
  );
}

function CalendarPage({ areas, goals, activities, onCreate }: {
  areas: LifeArea[];
  goals: Goal[];
  activities: Activity[];
  onCreate: (body: unknown) => void;
}) {
  const [title, setTitle] = useState('');
  const [lifeAreaId, setLifeAreaId] = useState('');
  const [goalId, setGoalId] = useState('');
  const [plannedStartAt, setPlannedStartAt] = useState(toLocalInput(new Date()));
  const [durationMinutes, setDurationMinutes] = useState(45);

  const week = useMemo(() => nextSevenDays(), []);

  function submit(event: FormEvent) {
    event.preventDefault();
    const start = new Date(plannedStartAt);
    const end = new Date(start.getTime() + durationMinutes * 60000);
    onCreate({
      lifeAreaId: lifeAreaId || areas[0]?.id,
      goalId: goalId || null,
      milestoneId: null,
      templateId: null,
      title,
      description: '',
      plannedStartAt: start.toISOString(),
      plannedEndAt: end.toISOString(),
      actualStartAt: null,
      actualEndAt: null,
      durationMinutes,
      status: 'Planned',
      energyCost: 'Medium',
      mentalLoad: 'Medium',
      physicalLoad: 'Low',
      points: 5,
      notes: ''
    });
    setTitle('');
  }

  return (
    <section className="page">
      <header className="page-header"><div><p className="eyebrow">Planner</p><h2>Week calendar</h2></div></header>
      <form className="inline-form" onSubmit={submit}>
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Activity title" required />
        <select value={lifeAreaId} onChange={(event) => setLifeAreaId(event.target.value)} required>
          <option value="">Life area</option>
          {areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
        </select>
        <select value={goalId} onChange={(event) => setGoalId(event.target.value)}>
          <option value="">No goal</option>
          {goals.map((goal) => <option key={goal.id} value={goal.id}>{goal.title}</option>)}
        </select>
        <input type="datetime-local" value={plannedStartAt} onChange={(event) => setPlannedStartAt(event.target.value)} />
        <input type="number" min={5} value={durationMinutes} onChange={(event) => setDurationMinutes(Number(event.target.value))} />
        <button type="submit">Plan</button>
      </form>
      <div className="week-grid">
        {week.map((day) => (
          <div className="day-column" key={day.key}>
            <h3>{day.label}</h3>
            {activities.filter((activity) => sameDay(activity.plannedStartAt, day.date)).map((activity) => (
              <div className="calendar-item" key={activity.id} style={{ borderColor: activity.lifeAreaColor }}>
                <strong>{activity.title}</strong>
                <span>{formatTime(activity.plannedStartAt)} · {activity.durationMinutes}m</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function GoalsPage({ areas, goals, onCreate }: { areas: LifeArea[]; goals: Goal[]; onCreate: (body: unknown) => void }) {
  const [title, setTitle] = useState('');
  const [lifeAreaId, setLifeAreaId] = useState('');
  const [priority, setPriority] = useState('Secondary');

  function submit(event: FormEvent) {
    event.preventDefault();
    onCreate({
      lifeAreaId: lifeAreaId || areas[0]?.id,
      title,
      description: '',
      status: 'Active',
      priority,
      progressType: 'MilestoneBased',
      currentValue: 0,
      targetValue: 100,
      unit: '%',
      targetDate: null,
      maintenanceThreshold: 80,
      maintenanceTargetPerWeek: null,
      decayRatePercentPerWeek: 0
    });
    setTitle('');
  }

  return (
    <section className="page">
      <header className="page-header"><div><p className="eyebrow">Outcomes</p><h2>Goals</h2></div></header>
      <form className="inline-form" onSubmit={submit}>
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Goal title" required />
        <select value={lifeAreaId} onChange={(event) => setLifeAreaId(event.target.value)} required>
          <option value="">Life area</option>
          {areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
        </select>
        <select value={priority} onChange={(event) => setPriority(event.target.value)}>
          <option>Primary</option>
          <option>Secondary</option>
          <option>Maintenance</option>
        </select>
        <button type="submit">Create</button>
      </form>
      <div className="cards">
        {goals.map((goal) => <GoalCard key={goal.id} goal={goal} />)}
      </div>
    </section>
  );
}

function AreasPage({ areas, onCreate }: { areas: LifeArea[]; onCreate: (body: unknown) => void }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(colors[0]);

  function submit(event: FormEvent) {
    event.preventDefault();
    onCreate({ name, description: '', color, icon: 'circle', priorityWeight: 10, currentScore: 0, targetScore: 70, isActive: true });
    setName('');
  }

  return (
    <section className="page">
      <header className="page-header"><div><p className="eyebrow">Attention map</p><h2>Life Areas</h2></div></header>
      <form className="inline-form" onSubmit={submit}>
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Life area name" required />
        <div className="swatches">{colors.map((item) => <button type="button" aria-label={item} className={item === color ? 'selected' : ''} key={item} style={{ background: item }} onClick={() => setColor(item)} />)}</div>
        <button type="submit">Create</button>
      </form>
      <div className="cards">
        {areas.map((area) => (
          <article className="area-card" key={area.id}>
            <i style={{ background: area.color }} />
            <h3>{area.name}</h3>
            <p>{area.description || 'Ready to receive planned and completed activities.'}</p>
            <span>Weight {area.priorityWeight}</span>
          </article>
        ))}
      </div>
    </section>
  );
}

function MetricsPage({ areas, metrics, onCreate, onEntry }: {
  areas: LifeArea[];
  metrics: Metric[];
  onCreate: (body: unknown) => void;
  onEntry: (id: string, body: unknown) => void;
}) {
  const [name, setName] = useState('');
  const [lifeAreaId, setLifeAreaId] = useState('');
  const [entryValues, setEntryValues] = useState<Record<string, string>>({});

  function submit(event: FormEvent) {
    event.preventDefault();
    onCreate({ lifeAreaId: lifeAreaId || null, goalId: null, name, unit: '', valueType: 'Number', targetValue: null, sortOrder: 0, isActive: true });
    setName('');
  }

  return (
    <section className="page">
      <header className="page-header"><div><p className="eyebrow">Signals</p><h2>Metrics</h2></div></header>
      <form className="inline-form" onSubmit={submit}>
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Metric name" required />
        <select value={lifeAreaId} onChange={(event) => setLifeAreaId(event.target.value)}>
          <option value="">No area</option>
          {areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
        </select>
        <button type="submit">Create</button>
      </form>
      <div className="cards">
        {metrics.map((metric) => (
          <article className="metric-card" key={metric.id}>
            <h3>{metric.name}</h3>
            <p className="metric-value">{metric.latestEntry ? `${metric.latestEntry.value} ${metric.unit}` : 'No entries'}</p>
            <form onSubmit={(event) => {
              event.preventDefault();
              onEntry(metric.id, { value: Number(entryValues[metric.id] ?? 0), recordedAt: new Date().toISOString(), notes: '' });
              setEntryValues({ ...entryValues, [metric.id]: '' });
            }}>
              <input type="number" value={entryValues[metric.id] ?? ''} onChange={(event) => setEntryValues({ ...entryValues, [metric.id]: event.target.value })} placeholder="Value" />
              <button type="submit">Log</button>
            </form>
          </article>
        ))}
      </div>
    </section>
  );
}

function ReviewsPage({ reviews, onGenerate }: { reviews: Review[]; onGenerate: () => void }) {
  return (
    <section className="page">
      <header className="page-header">
        <div><p className="eyebrow">Reflection</p><h2>Weekly Review</h2></div>
        <button onClick={onGenerate}>Generate review</button>
      </header>
      <div className="review-list">
        {reviews.map((review) => (
          <article className="panel" key={review.id}>
            <h3>{review.periodStart} to {review.periodEnd}</h3>
            <p>{review.summary}</p>
            <strong>{review.nextFocus}</strong>
            {review.insights.map((insight) => <p className="insight" key={insight.id}>{insight.message}</p>)}
          </article>
        ))}
        {reviews.length === 0 && <p className="empty">Generate the first review after planning and completing a few activities.</p>}
      </div>
    </section>
  );
}

function BackupPage({ onExport }: { onExport: () => void }) {
  return (
    <section className="page">
      <header className="page-header"><div><p className="eyebrow">Local data</p><h2>Backup</h2></div></header>
      <section className="panel">
        <h3>Export local SQLite data</h3>
        <p>Creates a ZIP backup with the database and a manifest in the local backups folder.</p>
        <button onClick={onExport}>Export backup</button>
      </section>
    </section>
  );
}

function FocusBlock({ title, activity, onComplete, onSkip }: { title: string; activity?: Activity; onComplete: (id: string) => void; onSkip: (id: string) => void }) {
  return (
    <article className="focus-block">
      <p className="eyebrow">{title}</p>
      {activity ? <ActivityRow activity={activity} onComplete={onComplete} onSkip={onSkip} /> : <p className="empty">Nothing assigned.</p>}
    </article>
  );
}

function ActivityRow({ activity, onComplete, onSkip }: { activity: Activity; onComplete: (id: string) => void; onSkip: (id: string) => void }) {
  return (
    <div className="activity-row">
      <span className="dot" style={{ background: activity.lifeAreaColor }} />
      <div>
        <strong>{activity.title}</strong>
        <p>{activity.lifeAreaName} · {activity.durationMinutes}m · {activity.status}</p>
      </div>
      {activity.status === 'Planned' && (
        <div className="row-actions">
          <button onClick={() => onComplete(activity.id)}>Done</button>
          <button className="secondary" onClick={() => onSkip(activity.id)}>Skip</button>
        </div>
      )}
    </div>
  );
}

function GoalCard({ goal }: { goal: Goal }) {
  return (
    <article className="goal-card">
      <div className="card-top">
        <span style={{ background: goal.lifeAreaColor }}>{goal.lifeAreaName}</span>
        <strong>{goal.priority}</strong>
      </div>
      <h3>{goal.title}</h3>
      <div className="progress"><i style={{ width: `${goal.currentValue}%`, background: goal.lifeAreaColor }} /></div>
      <p>{goal.currentValue}% · {goal.status}</p>
    </article>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="stat"><strong>{value}</strong><span>{label}</span></div>;
}

function nextSevenDays() {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() + index);
    return {
      date,
      key: date.toISOString().slice(0, 10),
      label: date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
    };
  });
}

function sameDay(value: string | undefined, date: Date) {
  if (!value) return false;
  const other = new Date(value);
  return other.toDateString() === date.toDateString();
}

function formatTime(value: string | undefined) {
  return value ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Anytime';
}

function toLocalInput(date: Date) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
