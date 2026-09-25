// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App, { liveCountdownTiming, parseWorkoutExercises } from './App';

const area = {
  id: 'area-1',
  name: 'Career',
  description: 'Business growth',
  color: '#2563eb',
  icon: 'briefcase',
  priorityWeight: 10,
  currentScore: 40,
  targetScore: 80,
  isActive: true
};

const goal = {
  id: 'goal-1',
  lifeAreaId: area.id,
  lifeAreaName: area.name,
  lifeAreaColor: area.color,
  title: 'Build Axis',
  description: 'Ship a clean operating system',
  status: 'Active',
  priority: 'Primary',
  progressType: 'MilestoneBased',
  currentValue: 20,
  targetValue: 100,
  unit: '%',
  targetDate: null,
  maintenanceThreshold: 80,
  maintenanceTargetPerWeek: 1,
  decayRatePercentPerWeek: 2,
  milestones: [
    {
      id: 'milestone-1',
      goalId: 'goal-1',
      title: 'QA flow',
      description: '',
      type: 'Count',
      currentValue: 0,
      targetValue: 1,
      unit: 'done',
      progress: 0,
      sortOrder: 1,
      status: 'Active',
      dueDate: null
    }
  ]
};

const activity = {
  id: 'activity-1',
  lifeAreaId: area.id,
  lifeAreaName: area.name,
  lifeAreaColor: area.color,
  goalId: goal.id,
  goalTitle: goal.title,
  milestoneId: 'milestone-1',
  templateId: 'template-1',
  title: 'Deep work',
  description: 'Focus block',
  plannedStartAt: new Date('2026-09-16T09:00:00.000Z').toISOString(),
  plannedEndAt: new Date('2026-09-16T10:00:00.000Z').toISOString(),
  actualStartAt: null,
  actualEndAt: null,
  durationMinutes: 60,
  status: 'Planned',
  energyCost: 'High',
  mentalLoad: 'High',
  physicalLoad: 'Low',
  points: 8,
  notes: ''
};

const completedRecentActivity = {
  ...activity,
  id: 'activity-completed-recent',
  title: 'Yesterday creatine',
  plannedStartAt: new Date('2026-09-15T08:00:00.000Z').toISOString(),
  plannedEndAt: new Date('2026-09-15T08:01:00.000Z').toISOString(),
  status: 'Completed'
};

const missedRecentActivity = {
  ...activity,
  id: 'activity-missed-recent',
  title: 'Yesterday stretching',
  plannedStartAt: new Date('2026-09-15T18:00:00.000Z').toISOString(),
  plannedEndAt: new Date('2026-09-15T18:15:00.000Z').toISOString()
};

const skippedRecentActivity = {
  ...activity,
  id: 'activity-skipped-recent',
  title: 'Earlier workout',
  plannedStartAt: new Date('2026-09-14T17:00:00.000Z').toISOString(),
  plannedEndAt: new Date('2026-09-14T18:00:00.000Z').toISOString(),
  status: 'Skipped'
};

const template = {
  id: 'template-1',
  lifeAreaId: area.id,
  lifeAreaName: area.name,
  lifeAreaColor: area.color,
  title: 'Deep work template',
  description: 'Reusable focus',
  defaultDurationMinutes: 60,
  energyCost: 'High',
  mentalLoad: 'High',
  physicalLoad: 'Low',
  defaultPoints: 8,
  isActive: true
};

const workoutTemplate = {
  ...template,
  id: 'template-workout',
  lifeAreaId: area.id,
  title: 'Hypertrophy workout',
  description: 'Progressive resistance session',
  defaultDurationMinutes: 75,
  physicalLoad: 'High'
};

const sleepTemplate = {
  ...template,
  id: 'template-sleep',
  title: 'Sleep log',
  description: 'Estimated sleep duration',
  defaultDurationMinutes: 1,
  energyCost: 'Low',
  mentalLoad: 'Low',
  physicalLoad: 'Low'
};

const nutritionTemplate = { ...sleepTemplate, id: 'template-nutrition', title: 'Daily nutrition', description: 'Calories and macros' };
const stepsTemplate = { ...sleepTemplate, id: 'template-steps', title: 'Steps', description: 'Daily steps' };
const waterTemplate = { ...sleepTemplate, id: 'template-water', title: 'Water intake', description: 'Daily water' };
const measurementLedgerActivity = { ...activity, id: 'measurement-ledger', templateId: stepsTemplate.id, title: 'Steps', description: 'Daily steps' };

const recurrenceRule = {
  id: 'rule-1',
  templateId: template.id,
  templateTitle: template.title,
  lifeAreaName: area.name,
  lifeAreaColor: area.color,
  frequency: 'Weekly',
  interval: 1,
  daysOfWeek: 'Wednesday',
  startDate: '2026-09-16',
  endDate: null
};

const metric = {
  id: 'metric-1',
  lifeAreaId: area.id,
  goalId: goal.id,
  name: 'Body weight',
  unit: 'kg',
  valueType: 'Number',
  targetValue: null,
  isActive: true,
  latestEntry: null
};

const stepsMetric = { ...metric, id: 'metric-steps', goalId: null, name: 'Steps', unit: 'steps', targetValue: 10000, latestEntry: null };
const caloriesMetric = { ...metric, id: 'metric-calories', goalId: null, name: 'Calories', unit: 'kcal', targetValue: null, latestEntry: null };
const waterMetric = { ...metric, id: 'metric-water', goalId: null, name: 'Water consumed', unit: 'ml', targetValue: 2600, latestEntry: null };

const review = {
  id: 'review-1',
  type: 'Weekly',
  periodStart: '2026-09-14',
  periodEnd: '2026-09-20',
  summary: 'A focused week.',
  whatWorked: '',
  whatDidNotWork: '',
  nextFocus: 'Keep shipping.',
  insights: [{ id: 'insight-1', message: 'Progress was made.', severity: 'Success' }]
};

type FetchCall = { method: string; path: string; body?: string };

const calls: FetchCall[] = [];

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  }));
}

function installFetchMock() {
  calls.length = 0;
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input.toString());
    const method = init?.method ?? 'GET';
    calls.push({ method, path: `${url.pathname}${url.search}`, body: init?.body?.toString() });

    if (method !== 'GET') {
      if (method === 'DELETE') {
        return Promise.resolve(new Response(null, { status: 204 }));
      }

      return jsonResponse({ id: 'saved' });
    }

    switch (url.pathname) {
      case '/api/life-areas':
        return jsonResponse([area]);
      case '/api/goals':
        return jsonResponse([goal]);
      case '/api/dashboard/progress':
        return jsonResponse([{ goal, baseProgress: 20, decayedProgress: 20, maintenanceThreshold: 80, maintenanceTargetPerWeek: 1, completedThisWeek: 0, completedDays: 0, trackingTargetDays: null, journeyProgress: null, currentStreakDays: 0, longestStreakDays: 0, maintenanceSatisfied: false }]);
      case '/api/activities':
        return jsonResponse([activity]);
      case '/api/activity-templates':
        return jsonResponse([template, workoutTemplate, sleepTemplate, nutritionTemplate, stepsTemplate, waterTemplate]);
      case '/api/recurrence-rules':
        return jsonResponse([recurrenceRule]);
      case '/api/metrics':
        return jsonResponse([metric, stepsMetric, caloriesMetric, waterMetric]);
      case '/api/metrics/metric-1/entries':
        return jsonResponse([{ id: 'weight-entry', metricId: 'metric-1', value: 74, recordedAt: '2026-09-18T08:00:00.000Z', notes: '' }]);
      case '/api/metrics/metric-steps/entries':
        return jsonResponse([{ id: 'steps-entry', metricId: 'metric-steps', value: 9000, recordedAt: '2026-09-18T20:00:00.000Z', notes: '' }]);
      case '/api/metrics/metric-calories/entries':
        return jsonResponse([{ id: 'calories-entry', metricId: 'metric-calories', value: 2200, recordedAt: '2026-09-18T21:00:00.000Z', notes: '' }]);
      case '/api/metrics/metric-water/entries':
        return jsonResponse([{ id: 'water-entry', metricId: 'metric-water', value: 2600, recordedAt: '2026-09-18T21:00:00.000Z', notes: '' }]);
      case '/api/reviews':
        return jsonResponse([review]);
      case '/api/mood':
      case '/api/diary':
      case '/api/countdowns':
      case '/api/physique':
      case '/api/wiki-pages':
      case '/api/life-lessons':
      case '/api/money/savings':
      case '/api/money/wishlist':
        return jsonResponse([]);
      case '/api/dashboard/today':
        return jsonResponse({
          date: '2026-09-16',
          primaryGoal: goal,
          mainFocus: activity,
          supportTasks: [],
          recoveryTask: null,
          timeline: [activity, measurementLedgerActivity],
          recentDays: [
            { date: '2026-09-16', isToday: true, activities: [activity, measurementLedgerActivity] },
            { date: '2026-09-15', isToday: false, activities: [completedRecentActivity, missedRecentActivity] },
            { date: '2026-09-14', isToday: false, activities: [skippedRecentActivity] }
          ],
          suggestion: 'Start with the focus block.'
        });
      case '/api/dashboard/suggestions':
        return jsonResponse([]);
      case '/api/dashboard':
        return jsonResponse({ activeGoals: 1, completedThisWeek: 0, primaryGoal: goal, message: 'Main axis: Build Axis' });
      case '/api/dashboard/balance':
        return jsonResponse([]);
      case '/api/backup/status':
        return jsonResponse({ databaseExists: true, databasePath: 'axis.db', backupDirectory: 'backups', recentBackups: [] });
      default:
        return jsonResponse({});
    }
  });

  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(window, 'confirm').mockReturnValue(true);
}

async function openPage(name: RegExp) {
  fireEvent.click(await screen.findByRole('button', { name }));
}

describe('Axis app integration workflows', () => {
  it('moves the countdown and its mirrored past date together as time advances', () => {
    const now = new Date('2026-09-25T12:00:00.000Z');
    const target = new Date(now.getTime() + 54 * 86400000).toISOString();

    const todayTiming = liveCountdownTiming(target, now);
    const tomorrowTiming = liveCountdownTiming(target, new Date(now.getTime() + 86400000));

    expect(todayTiming.daysRemaining).toBe(54);
    expect(todayTiming.pastEquivalentDate.toISOString().slice(0, 10)).toBe('2026-08-02');
    expect(tomorrowTiming.daysRemaining).toBe(53);
    expect(tomorrowTiming.pastEquivalentDate.toISOString().slice(0, 10)).toBe('2026-08-04');
  });

  it('upgrades legacy shared workout values into separate compatible sets', () => {
    const legacy = parseWorkoutExercises('[axis-workout-v1][{"id":"legacy","name":"Incline press","muscle":"Chest","sets":3,"reps":8,"weightKg":70,"rir":2}]');

    expect(legacy).toHaveLength(1);
    expect(legacy[0].sets).toHaveLength(3);
    expect(legacy[0].sets.map((set) => ({ reps: set.reps, weightKg: set.weightKg }))).toEqual([
      { reps: 8, weightKg: 70 },
      { reps: 8, weightKg: 70 },
      { reps: 8, weightKg: 70 }
    ]);
    expect(legacy[0]).not.toHaveProperty('rir');
  });

  beforeEach(() => {
    localStorage.clear();
    installFetchMock();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('supports add, edit, delete, generate, search, and nullable metric rendering without crashing', async () => {
    render(<App />);

    await screen.findByText('Start with the focus block.');

    await openPage(/life areas/i);
    expect(screen.getByPlaceholderText('Search life areas')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Search life areas'), { target: { value: 'career' } });
    fireEvent.click(screen.getByRole('button', { name: 'New life area' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Health' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create area' }));
    await waitFor(() => expect(calls.some((call) => call.method === 'POST' && call.path === '/api/life-areas')).toBe(true));

    await openPage(/goals/i);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getAllByLabelText('Title')[0], { target: { value: 'Build Axis Pro' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(calls.some((call) => call.method === 'PUT' && call.path === '/api/goals/goal-1')).toBe(true));

    await openPage(/templates/i);
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
    await waitFor(() => expect(calls.some((call) => call.method === 'POST' && call.path === '/api/recurrence-rules/rule-1/generate')).toBe(true));

    await openPage(/metrics/i);
    expect(screen.getAllByText('No target comparison yet.').length).toBeGreaterThan(0);
    fireEvent.change(screen.getAllByPlaceholderText('Value')[0], { target: { value: '71.9' } });
    fireEvent.change(screen.getAllByPlaceholderText('Note')[0], { target: { value: 'logged from integration test' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Log' })[0]);
    await waitFor(() => expect(calls.some((call) => call.method === 'POST' && call.path === '/api/metrics/metric-1/entries' && call.body?.includes('71.9'))).toBe(true));

    fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
    fireEvent.change(screen.getByLabelText('Unit'), { target: { value: 'score' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(calls.some((call) => call.method === 'PUT' && call.path === '/api/metrics/metric-1')).toBe(true));

    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0]);
    await waitFor(() => expect(calls.some((call) => call.method === 'DELETE' && call.path === '/api/metrics/metric-1')).toBe(true));

    await openPage(/reviews/i);
    fireEvent.click(screen.getByRole('button', { name: 'Generate weekly' }));
    await waitFor(() => expect(calls.some((call) => call.method === 'POST' && call.path === '/api/reviews/weekly/generate')).toBe(true));
    fireEvent.click(screen.getByRole('button', { name: 'Edit reflection' }));
    fireEvent.change(screen.getByLabelText('What worked?'), { target: { value: 'Focus blocks.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save review' }));
    await waitFor(() => expect(calls.some((call) => call.method === 'PUT' && call.path === '/api/reviews/review-1')).toBe(true));
  });

  it('opens calendar and metric editors in dismissible drawers', async () => {
    render(<App />);
    await screen.findByText('Start with the focus block.');

    await openPage(/calendar/i);
    expect(screen.queryByLabelText('Create activity')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'New activity' }));
    expect(screen.getByLabelText('Create activity')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close Create activity' }));
    expect(screen.queryByLabelText('Create activity')).not.toBeInTheDocument();

    await openPage(/metrics/i);
    expect(screen.queryByLabelText('Create metric')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'New metric' }));
    expect(screen.getByLabelText('Create metric')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByLabelText('Create metric')).not.toBeInTheDocument();
  });

  it('shows today and the previous two days with open, done, missed, and skipped outcomes', async () => {
    render(<App />);

    await screen.findByText('Execution ledger');
    const todayActivity = screen.getAllByText('Deep work').find((element) => element.closest('.execution-activity'));
    expect(todayActivity?.closest('.execution-activity')).toHaveTextContent('Open');
    expect(screen.getByText('Yesterday creatine').closest('.execution-activity')).toHaveTextContent('Done');
    expect(screen.getByText('Yesterday stretching').closest('.execution-activity')).toHaveTextContent('Missed');
    expect(screen.getByText('Earlier workout').closest('.execution-activity')).toHaveTextContent('Skipped');
    expect(document.querySelector('.execution-day.today')).toHaveTextContent('Today');
    expect(screen.getByText('Yesterday')).toBeInTheDocument();
    expect(screen.getByText('2 days ago')).toBeInTheDocument();
    expect(document.querySelector('.execution-activity-list')).not.toHaveTextContent('Steps');
  });

  it('creates searchable life lessons and money records while hiding repeatables from calendar', async () => {
    render(<App />);
    await screen.findByText('Start with the focus block.');

    await openPage(/life lessons/i);
    fireEvent.click(screen.getByRole('button', { name: 'Add lesson' }));
    fireEvent.change(screen.getByLabelText('Lesson title'), { target: { value: 'Protect deep work' } });
    fireEvent.change(screen.getByLabelText('Advice to future me'), { target: { value: 'Do the important thing before opening chat.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save lesson' }));
    await waitFor(() => expect(calls.some((call) => call.method === 'POST' && call.path === '/api/life-lessons')).toBe(true));

    await openPage(/money/i);
    fireEvent.click(screen.getByRole('button', { name: 'Savings log' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Record balance' }).at(-1)!);
    fireEvent.change(screen.getByLabelText('Current saved amount'), { target: { value: '5000' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Record balance' }).at(-1)!);
    await waitFor(() => expect(calls.some((call) => call.method === 'POST' && call.path === '/api/money/savings')).toBe(true));

    await openPage(/calendar/i);
    expect(screen.queryByText('Deep work')).not.toBeInTheDocument();
  });

  it('combines mood and diary backdating and stores structured workout exercises', async () => {
    render(<App />);
    await screen.findByText('Start with the focus block.');

    await openPage(/journal/i);
    fireEvent.click(screen.getByRole('button', { name: 'New check-in' }));
    fireEvent.change(screen.getByLabelText('When'), { target: { value: '2026-09-15T20:30' } });
    fireEvent.change(screen.getByLabelText('What is happening?'), { target: { value: 'Post-training reflection' } });
    fireEvent.change(screen.getByLabelText('Diary title (optional)'), { target: { value: 'Training day' } });
    fireEvent.change(screen.getByLabelText('Diary'), { target: { value: 'Good energy and a clear progression target.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save check-in' }));

    await waitFor(() => {
      expect(calls.some((call) => call.method === 'POST' && call.path === '/api/mood' && call.body?.includes('2026-09-15'))).toBe(true);
      expect(calls.some((call) => call.method === 'POST' && call.path === '/api/diary' && call.body?.includes('Training day'))).toBe(true);
    });

    await openPage(/today/i);
    fireEvent.click(await screen.findByRole('button', { name: /hypertrophy workout/i }));
    fireEvent.change(screen.getByLabelText('Exercise 1'), { target: { value: 'Incline press' } });
    fireEvent.change(screen.getByLabelText('Incline press set 1 reps'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Incline press set 1 kg'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Incline press set 2 reps'), { target: { value: '8' } });
    fireEvent.change(screen.getByLabelText('Incline press set 2 kg'), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText('Incline press set 3 reps'), { target: { value: '6' } });
    fireEvent.change(screen.getByLabelText('Incline press set 3 kg'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Log completed work' }));

    await waitFor(() => {
      const workoutCall = calls.find((call) => call.method === 'POST' && call.path === '/api/activities' && call.body?.includes('Incline press'));
      expect(workoutCall?.body).toContain('[axis-workout-v1]');
      expect(workoutCall?.body).toContain('\\"reps\\":10,\\"weightKg\\":10');
      expect(workoutCall?.body).toContain('\\"reps\\":8,\\"weightKg\\":5');
      expect(workoutCall?.body).toContain('\\"reps\\":6,\\"weightKg\\":5');
      expect(workoutCall?.body).not.toContain('\\"rir\\"');
    });
  });

  it('keeps decimal body weight and minute-accurate sleep values in API payloads', async () => {
    render(<App />);
    await screen.findByText('Start with the focus block.');

    await openPage(/physique/i);
    fireEvent.click(screen.getByRole('button', { name: 'Log physique' }));
    const weightInput = screen.getByLabelText('Weight kg');
    expect(weightInput).toHaveAttribute('step', '0.1');
    fireEvent.change(weightInput, { target: { value: '71.9' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Log physique' }).at(-1)!);

    await waitFor(() => {
      expect(calls.some((call) => call.method === 'POST' && call.path === '/api/physique' && call.body?.includes('"weightKg":71.9'))).toBe(true);
    });

    await openPage(/today/i);
    fireEvent.click(await screen.findByRole('button', { name: /sleep log/i }));
    fireEvent.change(screen.getByLabelText('Sleep hours'), { target: { value: '7' } });
    fireEvent.change(screen.getByLabelText('Extra minutes'), { target: { value: '20' } });
    expect(screen.getByText(/7h 20m · Minimum healthy range/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Log completed work' }));

    await waitFor(() => {
      const sleepCall = calls.find((call) => call.method === 'POST' && call.path === '/api/activities' && call.body?.includes('Sleep log'));
      expect(sleepCall?.body).toContain('Quantity: 7.333333333333333');
      expect(Number.isInteger(JSON.parse(sleepCall!.body!).points)).toBe(true);
      expect(JSON.parse(sleepCall!.body!).points).toBe(sleepTemplate.defaultPoints);
    });
  });

  it('logs steps, water, calories, and macros directly from Metrics without creating activities', async () => {
    render(<App />);
    await screen.findByText('Start with the focus block.');
    await openPage(/metrics/i);

    const day = screen.getByLabelText('Measurement day');
    expect(day).toHaveAttribute('min');
    expect(day).toHaveAttribute('max');
    fireEvent.change(screen.getByLabelText('Daily steps'), { target: { value: '10433' } });
    fireEvent.change(screen.getByLabelText('Daily water liters'), { target: { value: '2.7' } });
    fireEvent.change(screen.getByLabelText('Daily calories'), { target: { value: '2350' } });
    fireEvent.change(screen.getByLabelText('Daily protein'), { target: { value: '145.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save measurements' }));

    await waitFor(() => {
      const call = calls.find((item) => item.method === 'POST' && item.path === '/api/metrics/daily-measurements');
      expect(call?.body).toContain('"steps":10433');
      expect(call?.body).toContain('"waterMl":2700');
      expect(call?.body).toContain('"calories":2350');
      expect(call?.body).toContain('"protein":145.5');
    });
    expect(calls.some((item) => item.method === 'POST' && item.path === '/api/activities' && /Daily nutrition|Steps|Water intake/.test(item.body ?? ''))).toBe(false);
  });

  it('loads a selectable normalized metric comparison with exact daily values', async () => {
    render(<App />);
    await screen.findByText('Start with the focus block.');
    await openPage(/metrics/i);

    expect(await screen.findByText('Metric comparison')).toBeInTheDocument();
    await waitFor(() => expect(calls.some((item) => item.path.startsWith('/api/metrics/metric-steps/entries?from='))).toBe(true));
    expect(screen.getByRole('img', { name: 'Normalized comparison of selected metrics over time' })).toBeInTheDocument();
    expect(screen.getByText('Each line uses its own low-to-high scale')).toBeInTheDocument();
    expect((await screen.findAllByText(/9[,. ]?000 steps/)).length).toBeGreaterThan(0);
    expect((await screen.findAllByText(/2[,. ]?600 ml/)).length).toBeGreaterThan(0);
  });

  it('shows concise error toasts and reveals technical details on demand', async () => {
    render(<App />);
    await screen.findByText('Start with the focus block.');
    const fullError = 'Microsoft.AspNetCore.Http.BadHttpRequestException: Failed to read parameter "ActivityRequest request" from the request body as JSON. at Server.Stack.Trace';
    vi.mocked(fetch).mockImplementationOnce(() => Promise.resolve(new Response(fullError, { status: 400 })));

    fireEvent.click(screen.getAllByRole('button', { name: 'Done' })[0]);
    expect(await screen.findByText('The server rejected one of the submitted values.')).toBeInTheDocument();
    expect(screen.queryByText(fullError)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Details' }));
    expect(screen.getByText(fullError)).toBeInTheDocument();
  });

  it('shows calendar-accurate year progress in the journal', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 19, 12, 0, 0));
    render(<App />);
    await screen.findByText('Start with the focus block.');

    await openPage(/journal/i);
    expect(screen.getByLabelText('71.64% of 2026 complete')).toBeInTheDocument();
    expect(screen.getByText('Day 262 of 365')).toBeInTheDocument();
    expect(screen.getByText('103 days remaining after today')).toBeInTheDocument();
  });
});
