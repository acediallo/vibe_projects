import type { Exercise } from '@/db/types'

// Compact starter library — extend from Settings > Exercise library.
export const SEED_EXERCISES: Omit<Exercise, 'id' | 'is_custom' | 'archived_at'>[] = [
  // Chest
  { name: 'Barbell Bench Press',      muscle_group: 'Chest',     equipment: 'Barbell',      default_rest_seconds: 150, is_bodyweight: 0, notes: null },
  { name: 'Incline Dumbbell Press',   muscle_group: 'Chest',     equipment: 'Dumbbell',     default_rest_seconds: 120, is_bodyweight: 0, notes: null },
  { name: 'Cable Fly',                muscle_group: 'Chest',     equipment: 'Cable',        default_rest_seconds: 75,  is_bodyweight: 0, notes: null },
  { name: 'Push-Up',                  muscle_group: 'Chest',     equipment: 'Bodyweight',   default_rest_seconds: 60,  is_bodyweight: 1, notes: null },

  // Back
  { name: 'Deadlift',                 muscle_group: 'Back',      equipment: 'Barbell',      default_rest_seconds: 210, is_bodyweight: 0, notes: null },
  { name: 'Barbell Row',              muscle_group: 'Back',      equipment: 'Barbell',      default_rest_seconds: 150, is_bodyweight: 0, notes: null },
  { name: 'Lat Pulldown',             muscle_group: 'Back',      equipment: 'Cable',        default_rest_seconds: 90,  is_bodyweight: 0, notes: null },
  { name: 'Pull-Up',                  muscle_group: 'Back',      equipment: 'Bodyweight',   default_rest_seconds: 120, is_bodyweight: 1, notes: null },
  { name: 'Seated Cable Row',         muscle_group: 'Back',      equipment: 'Cable',        default_rest_seconds: 90,  is_bodyweight: 0, notes: null },

  // Legs
  { name: 'Back Squat',               muscle_group: 'Legs',      equipment: 'Barbell',      default_rest_seconds: 180, is_bodyweight: 0, notes: null },
  { name: 'Romanian Deadlift',        muscle_group: 'Legs',      equipment: 'Barbell',      default_rest_seconds: 150, is_bodyweight: 0, notes: null },
  { name: 'Leg Press',                muscle_group: 'Legs',      equipment: 'Machine',      default_rest_seconds: 120, is_bodyweight: 0, notes: null },
  { name: 'Bulgarian Split Squat',    muscle_group: 'Legs',      equipment: 'Dumbbell',     default_rest_seconds: 90,  is_bodyweight: 0, notes: null },
  { name: 'Leg Curl',                 muscle_group: 'Legs',      equipment: 'Machine',      default_rest_seconds: 75,  is_bodyweight: 0, notes: null },
  { name: 'Leg Extension',            muscle_group: 'Legs',      equipment: 'Machine',      default_rest_seconds: 75,  is_bodyweight: 0, notes: null },
  { name: 'Standing Calf Raise',      muscle_group: 'Legs',      equipment: 'Machine',      default_rest_seconds: 60,  is_bodyweight: 0, notes: null },

  // Shoulders
  { name: 'Overhead Press',           muscle_group: 'Shoulders', equipment: 'Barbell',      default_rest_seconds: 150, is_bodyweight: 0, notes: null },
  { name: 'Dumbbell Shoulder Press',  muscle_group: 'Shoulders', equipment: 'Dumbbell',     default_rest_seconds: 120, is_bodyweight: 0, notes: null },
  { name: 'Lateral Raise',            muscle_group: 'Shoulders', equipment: 'Dumbbell',     default_rest_seconds: 60,  is_bodyweight: 0, notes: null },
  { name: 'Face Pull',                muscle_group: 'Shoulders', equipment: 'Cable',        default_rest_seconds: 60,  is_bodyweight: 0, notes: null },

  // Arms
  { name: 'Barbell Curl',             muscle_group: 'Arms',      equipment: 'Barbell',      default_rest_seconds: 75,  is_bodyweight: 0, notes: null },
  { name: 'Dumbbell Curl',            muscle_group: 'Arms',      equipment: 'Dumbbell',     default_rest_seconds: 60,  is_bodyweight: 0, notes: null },
  { name: 'Hammer Curl',              muscle_group: 'Arms',      equipment: 'Dumbbell',     default_rest_seconds: 60,  is_bodyweight: 0, notes: null },
  { name: 'Triceps Pushdown',         muscle_group: 'Arms',      equipment: 'Cable',        default_rest_seconds: 60,  is_bodyweight: 0, notes: null },
  { name: 'Overhead Triceps Ext.',    muscle_group: 'Arms',      equipment: 'Cable',        default_rest_seconds: 60,  is_bodyweight: 0, notes: null },
  { name: 'Skullcrusher',             muscle_group: 'Arms',      equipment: 'Barbell',      default_rest_seconds: 75,  is_bodyweight: 0, notes: null },

  // Core
  { name: 'Plank',                    muscle_group: 'Core',      equipment: 'Bodyweight',   default_rest_seconds: 45,  is_bodyweight: 1, notes: null },
  { name: 'Hanging Leg Raise',        muscle_group: 'Core',      equipment: 'Bodyweight',   default_rest_seconds: 60,  is_bodyweight: 1, notes: null },
  { name: 'Cable Crunch',             muscle_group: 'Core',      equipment: 'Cable',        default_rest_seconds: 45,  is_bodyweight: 0, notes: null },

  // Cardio
  { name: 'Treadmill',                muscle_group: 'Cardio',    equipment: 'Machine',      default_rest_seconds: 0,   is_bodyweight: 0, notes: null },
  { name: 'Rowing Machine',           muscle_group: 'Cardio',    equipment: 'Machine',      default_rest_seconds: 0,   is_bodyweight: 0, notes: null },
]
