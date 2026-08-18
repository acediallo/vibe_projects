import { getDb } from './index'
import type { Exercise, MuscleGroup, Equipment } from './types'
import { newId } from '@/lib/id'

export async function listExercises(includeArchived = false): Promise<Exercise[]> {
  const db = await getDb()
  const where = includeArchived ? '' : 'WHERE archived_at IS NULL'
  return db.getAllAsync<Exercise>(
    `SELECT * FROM exercises ${where} ORDER BY muscle_group, name`
  )
}

export async function getExercise(id: string): Promise<Exercise | null> {
  const db = await getDb()
  return (await db.getFirstAsync<Exercise>(
    'SELECT * FROM exercises WHERE id = ?',
    id,
  )) ?? null
}

export interface NewExerciseInput {
  name: string
  muscle_group: MuscleGroup
  equipment: Equipment
  default_rest_seconds?: number
  is_bodyweight?: boolean
  notes?: string | null
}

export async function createExercise(input: NewExerciseInput): Promise<Exercise> {
  const db = await getDb()
  const id = newId()
  const rest = input.default_rest_seconds ?? 90
  const bw = input.is_bodyweight ? 1 : 0
  await db.runAsync(
    `INSERT INTO exercises
       (id, name, muscle_group, equipment, default_rest_seconds, is_bodyweight, is_custom, notes)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
    id,
    input.name.trim(),
    input.muscle_group,
    input.equipment,
    rest,
    bw,
    input.notes ?? null,
  )
  return (await getExercise(id))!
}

export async function updateExerciseRest(id: string, rest: number): Promise<void> {
  const db = await getDb()
  await db.runAsync(
    'UPDATE exercises SET default_rest_seconds = ? WHERE id = ?',
    rest,
    id,
  )
}

export async function archiveExercise(id: string): Promise<void> {
  const db = await getDb()
  await db.runAsync(
    'UPDATE exercises SET archived_at = ? WHERE id = ?',
    Date.now(),
    id,
  )
}
