// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

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
  name: 'Revenue signal',
  unit: 'pts',
  valueType: 'Number',
  targetValue: null,
  isActive: true,
  latestEntry: null
};

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
        return jsonResponse([template, workoutTemplate]);
      case '/api/recurrence-rules':
        return jsonResponse([recurrenceRule]);
      case '/api/metrics':
        return jsonResponse([metric]);
      case '/api/metrics/metric-1/entries':
        return jsonResponse([]);
      case '/api/reviews':
        return jsonResponse([review]);
      case '/api/mood':
      case '/api/diary':
      case '/api/countdowns':
      case '/api/physique':
      case '/api/wiki-pages':
        return jsonResponse([]);
      case '/api/dashboard/today':
        return jsonResponse({
          date: '2026-09-16',
          primaryGoal: goal,
          mainFocus: activity,
          supportTasks: [],
          recoveryTask: null,
          timeline: [activity],
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
  beforeEach(() => {
    localStorage.clear();
    installFetchMock();
  });

  afterEach(() => {
    cleanup();
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
    expect(screen.getByText('No target comparison yet.')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Value'), { target: { value: '8' } });
    fireEvent.change(screen.getByPlaceholderText('Note'), { target: { value: 'logged from integration test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Log' }));
    await waitFor(() => expect(calls.some((call) => call.method === 'POST' && call.path === '/api/metrics/metric-1/entries')).toBe(true));

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText('Unit'), { target: { value: 'score' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(calls.some((call) => call.method === 'PUT' && call.path === '/api/metrics/metric-1')).toBe(true));

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
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
    fireEvent.change(screen.getByLabelText('kg'), { target: { value: '70' } });
    fireEvent.click(screen.getByRole('button', { name: 'Log completed work' }));

    await waitFor(() => {
      const workoutCall = calls.find((call) => call.method === 'POST' && call.path === '/api/activities' && call.body?.includes('Incline press'));
      expect(workoutCall?.body).toContain('[axis-workout-v1]');
      expect(workoutCall?.body).toContain('\\"weightKg\\":70');
    });
  });
});
