export type MuscleGroup =
  | 'Chest' | 'Back' | 'Legs' | 'Shoulders' | 'Arms' | 'Core' | 'Cardio' | 'Other'

export type Equipment =
  | 'Barbell' | 'Dumbbell' | 'Cable' | 'Machine' | 'Bodyweight' | 'Kettlebell' | 'Band' | 'Other'

export type SetType = 'warmup' | 'working' | 'dropset' | 'failure'

export interface Exercise {
  id: string
  name: string
  muscle_group: MuscleGroup
  equipment: Equipment
  default_rest_seconds: number
  is_bodyweight: 0 | 1
  is_custom: 0 | 1
  notes: string | null
  archived_at: number | null
}

export interface Workout {
  id: string
  name: string | null
  started_at: number
  ended_at: number | null
  notes: string | null
}

export interface WorkoutExercise {
  id: string
  workout_id: string
  exercise_id: string
  position: number
  rest_seconds: number
  superset_group: number | null
}

export interface WorkoutSet {
  id: string
  workout_exercise_id: string
  position: number
  set_type: SetType
  target_reps: number | null
  target_weight_kg: number | null
  actual_reps: number | null
  actual_weight_kg: number | null
  completed_at: number | null
}
