import { getDb } from './index'
import { newId } from '@/lib/id'
import type { Workout, WorkoutExercise, WorkoutSet, Exercise } from './types'

export interface ActiveWorkoutSnapshot {
  workout: Workout
  exercises: Array<{
    we: WorkoutExercise
    exercise: Exercise
    sets: WorkoutSet[]
  }>
}

export async function createWorkout(name: string | null): Promise<Workout> {
  const db = await getDb()
  const w: Workout = {
    id: newId(),
    name,
    started_at: Date.now(),
    ended_at: null,
    notes: null,
  }
  await db.runAsync(
    'INSERT INTO workouts (id, name, started_at, ended_at, notes) VALUES (?, ?, ?, NULL, NULL)',
    w.id,
    w.name,
    w.started_at,
  )
  return w
}

export async function addExerciseToWorkout(
  workoutId: string,
  exercise: Exercise,
): Promise<WorkoutExercise> {
  const db = await getDb()
  const posRow = await db.getFirstAsync<{ n: number | null }>(
    'SELECT MAX(position) AS n FROM workout_exercises WHERE workout_id = ?',
    workoutId,
  )
  const position = (posRow?.n ?? -1) + 1
  const we: WorkoutExercise = {
    id: newId(),
    workout_id: workoutId,
    exercise_id: exercise.id,
    position,
    rest_seconds: exercise.default_rest_seconds,
    superset_group: null,
  }
  await db.runAsync(
    `INSERT INTO workout_exercises
       (id, workout_id, exercise_id, position, rest_seconds, superset_group)
     VALUES (?, ?, ?, ?, ?, NULL)`,
    we.id,
    we.workout_id,
    we.exercise_id,
    we.position,
    we.rest_seconds,
  )
  // Seed a first working set so the row isn't empty.
  await addSet(we.id)
  return we
}

export async function addSet(
  workoutExerciseId: string,
  copyFromLast = true,
): Promise<WorkoutSet> {
  const db = await getDb()
  const last = await db.getFirstAsync<WorkoutSet>(
    'SELECT * FROM workout_sets WHERE workout_exercise_id = ? ORDER BY position DESC LIMIT 1',
    workoutExerciseId,
  )
  const position = (last?.position ?? -1) + 1
  const set: WorkoutSet = {
    id: newId(),
    workout_exercise_id: workoutExerciseId,
    position,
    set_type: 'working',
    target_reps: copyFromLast ? last?.target_reps ?? null : null,
    target_weight_kg: copyFromLast ? last?.target_weight_kg ?? null : null,
    actual_reps: null,
    actual_weight_kg: null,
    completed_at: null,
  }
  await db.runAsync(
    `INSERT INTO workout_sets
       (id, workout_exercise_id, position, set_type,
        target_reps, target_weight_kg, actual_reps, actual_weight_kg, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, NULL)`,
    set.id,
    set.workout_exercise_id,
    set.position,
    set.set_type,
    set.target_reps,
    set.target_weight_kg,
  )
  return set
}

export async function updateSet(
  id: string,
  patch: Partial<Pick<WorkoutSet,
    'actual_reps' | 'actual_weight_kg' | 'target_reps' | 'target_weight_kg' | 'set_type' | 'completed_at'
  >>,
): Promise<void> {
  const keys = Object.keys(patch) as (keyof typeof patch)[]
  if (keys.length === 0) return
  const db = await getDb()
  const assignments = keys.map((k) => `${k} = ?`).join(', ')
  const values = keys.map((k) => (patch as Record<string, unknown>)[k])
  await db.runAsync(`UPDATE workout_sets SET ${assignments} WHERE id = ?`, ...values, id)
}

export async function deleteSet(id: string): Promise<void> {
  const db = await getDb()
  await db.runAsync('DELETE FROM workout_sets WHERE id = ?', id)
}

export async function updateWorkoutExerciseRest(
  workoutExerciseId: string,
  rest_seconds: number,
): Promise<void> {
  const db = await getDb()
  await db.runAsync(
    'UPDATE workout_exercises SET rest_seconds = ? WHERE id = ?',
    rest_seconds,
    workoutExerciseId,
  )
}

export async function removeWorkoutExercise(id: string): Promise<void> {
  const db = await getDb()
  await db.runAsync('DELETE FROM workout_exercises WHERE id = ?', id)
}

export async function finishWorkout(id: string, notes: string | null): Promise<void> {
  const db = await getDb()
  await db.runAsync(
    'UPDATE workouts SET ended_at = ?, notes = ? WHERE id = ?',
    Date.now(),
    notes,
    id,
  )
}

export async function discardWorkout(id: string): Promise<void> {
  const db = await getDb()
  await db.runAsync('DELETE FROM workouts WHERE id = ?', id)
}

export async function loadWorkoutSnapshot(
  workoutId: string,
): Promise<ActiveWorkoutSnapshot | null> {
  const db = await getDb()
  const workout = await db.getFirstAsync<Workout>(
    'SELECT * FROM workouts WHERE id = ?',
    workoutId,
  )
  if (!workout) return null

  const wes = await db.getAllAsync<WorkoutExercise>(
    'SELECT * FROM workout_exercises WHERE workout_id = ? ORDER BY position',
    workoutId,
  )
  const exercises = await Promise.all(
    wes.map(async (we) => {
      const exercise = (await db.getFirstAsync<Exercise>(
        'SELECT * FROM exercises WHERE id = ?',
        we.exercise_id,
      ))!
      const sets = await db.getAllAsync<WorkoutSet>(
        'SELECT * FROM workout_sets WHERE workout_exercise_id = ? ORDER BY position',
        we.id,
      )
      return { we, exercise, sets }
    }),
  )
  return { workout, exercises }
}

export async function findInProgressWorkout(): Promise<Workout | null> {
  const db = await getDb()
  return (await db.getFirstAsync<Workout>(
    'SELECT * FROM workouts WHERE ended_at IS NULL ORDER BY started_at DESC LIMIT 1',
  )) ?? null
}

export async function listFinishedWorkouts(limit = 50): Promise<Workout[]> {
  const db = await getDb()
  return db.getAllAsync<Workout>(
    'SELECT * FROM workouts WHERE ended_at IS NOT NULL ORDER BY started_at DESC LIMIT ?',
    limit,
  )
}
