import { workoutMarker } from '../config';
import { roundNumber } from './format';

export type WorkoutSet = {
  id: string;
  reps: number;
  weightKg: number;
};

export type WorkoutExercise = {
  id: string;
  name: string;
  muscle: string;
  sets: WorkoutSet[];
};

export function createWorkoutSet(source?: Pick<WorkoutSet, 'reps' | 'weightKg'>): WorkoutSet {
  return {
    id: `set-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    reps: source?.reps ?? 10,
    weightKg: source?.weightKg ?? 0
  };
}

export function createExercise(): WorkoutExercise {
  return {
    id: `exercise-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: '',
    muscle: 'Chest',
    sets: [createWorkoutSet(), createWorkoutSet(), createWorkoutSet()]
  };
}

export function serializeWorkoutNotes(notes: string, exercises: WorkoutExercise[]) {
  const cleanNotes = stripWorkoutNotes(notes).trim();
  if (exercises.length === 0) return cleanNotes;
  return `${cleanNotes}${cleanNotes ? '\n\n' : ''}${workoutMarker}${JSON.stringify(exercises)}`;
}

export function stripWorkoutNotes(notes: string) {
  const markerIndex = notes.indexOf(workoutMarker);
  return (markerIndex >= 0 ? notes.slice(0, markerIndex) : notes).trim();
}

export function parseWorkoutExercises(notes: string): WorkoutExercise[] {
  const markerIndex = notes.indexOf(workoutMarker);
  if (markerIndex < 0) return [];

  try {
    const value = JSON.parse(notes.slice(markerIndex + workoutMarker.length));
    if (!Array.isArray(value)) return [];
    return value.flatMap(parseExercise);
  } catch {
    return [];
  }
}

export function workoutExerciseVolume(exercise: WorkoutExercise) {
  return exercise.sets.reduce((sum, set) => sum + set.reps * set.weightKg, 0);
}

export function formatWorkoutSets(exercise: WorkoutExercise) {
  const setLabel = exercise.sets.length === 1 ? 'set' : 'sets';
  const details = exercise.sets
    .map((set) => `${set.reps} x ${roundNumber(set.weightKg)} kg`)
    .join(' · ');
  return `${exercise.sets.length} ${setLabel} · ${details}`;
}

function parseExercise(item: unknown): WorkoutExercise[] {
  if (!isStoredExercise(item)) return [];

  const sets = Array.isArray(item.sets)
    ? item.sets.filter(isStoredSet).map((set) => ({
      id: set.id || createWorkoutSet().id,
      reps: Math.max(1, Number(set.reps) || 1),
      weightKg: Math.max(0, Number(set.weightKg) || 0)
    }))
    : createLegacySets(item);

  return [{
    id: typeof item.id === 'string' ? item.id : createExercise().id,
    name: item.name,
    muscle: item.muscle,
    sets: sets.length ? sets : [createWorkoutSet()]
  }];
}

function createLegacySets(item: Record<string, unknown>) {
  const setCount = Math.max(1, Number(item.sets) || 1);
  return Array.from({ length: setCount }, () => createWorkoutSet({
    reps: Math.max(1, Number(item.reps) || 1),
    weightKg: Math.max(0, Number(item.weightKg) || 0)
  }));
}

function isStoredExercise(value: unknown): value is Record<string, unknown> & { name: string; muscle: string } {
  return Boolean(value)
    && typeof value === 'object'
    && typeof (value as Record<string, unknown>).name === 'string'
    && typeof (value as Record<string, unknown>).muscle === 'string';
}

function isStoredSet(value: unknown): value is { id?: string; reps?: unknown; weightKg?: unknown } {
  return Boolean(value) && typeof value === 'object';
}
