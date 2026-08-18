import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react'
import type { ReactNode } from 'react'
import * as Haptics from 'expo-haptics'
import type { Exercise, Workout, WorkoutExercise, WorkoutSet } from '@/db/types'
import {
  addExerciseToWorkout,
  addSet,
  createWorkout,
  deleteSet,
  discardWorkout,
  findInProgressWorkout,
  finishWorkout,
  loadWorkoutSnapshot,
  removeWorkoutExercise,
  updateSet,
  updateWorkoutExerciseRest,
} from '@/db/workouts'
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type Settings } from '@/lib/settings'

export interface ActiveExercise {
  we: WorkoutExercise
  exercise: Exercise
  sets: WorkoutSet[]
}

export interface Focus {
  workoutExerciseId: string
  setId: string
}

export interface RestTimer {
  workoutExerciseId: string
  endsAt: number   // ms epoch
  totalSeconds: number
}

interface State {
  workout: Workout | null
  exercises: ActiveExercise[]
  focus: Focus | null
  rest: RestTimer | null
  settings: Settings
  hydrated: boolean
}

const initialState: State = {
  workout: null,
  exercises: [],
  focus: null,
  rest: null,
  settings: DEFAULT_SETTINGS,
  hydrated: false,
}

type Action =
  | { type: 'HYDRATED'; workout: Workout | null; exercises: ActiveExercise[]; settings: Settings }
  | { type: 'SET_SETTINGS'; settings: Settings }
  | { type: 'SET_WORKOUT'; workout: Workout | null; exercises: ActiveExercise[] }
  | { type: 'SET_EXERCISES'; exercises: ActiveExercise[] }
  | { type: 'SET_FOCUS'; focus: Focus | null }
  | { type: 'START_REST'; rest: RestTimer }
  | { type: 'STOP_REST' }
  | { type: 'ADJUST_REST'; deltaSeconds: number }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'HYDRATED':
      return {
        ...state,
        hydrated: true,
        workout: action.workout,
        exercises: action.exercises,
        settings: action.settings,
      }
    case 'SET_SETTINGS':
      return { ...state, settings: action.settings }
    case 'SET_WORKOUT':
      return {
        ...state,
        workout: action.workout,
        exercises: action.exercises,
        focus: null,
        rest: null,
      }
    case 'SET_EXERCISES':
      return { ...state, exercises: action.exercises }
    case 'SET_FOCUS':
      return { ...state, focus: action.focus }
    case 'START_REST':
      return { ...state, rest: action.rest }
    case 'STOP_REST':
      return { ...state, rest: null }
    case 'ADJUST_REST': {
      if (!state.rest) return state
      const endsAt = Math.max(Date.now(), state.rest.endsAt + action.deltaSeconds * 1000)
      const totalSeconds = Math.max(0, state.rest.totalSeconds + action.deltaSeconds)
      return { ...state, rest: { ...state.rest, endsAt, totalSeconds } }
    }
    default:
      return state
  }
}

interface ContextValue extends State {
  startWorkout: (name?: string | null) => Promise<void>
  addExercise: (exercise: Exercise) => Promise<void>
  removeExercise: (workoutExerciseId: string) => Promise<void>
  addNewSet: (workoutExerciseId: string) => Promise<void>
  patchSet: (setId: string, patch: Partial<Pick<WorkoutSet,
    'actual_reps' | 'actual_weight_kg' | 'target_reps' | 'target_weight_kg' | 'set_type'
  >>) => Promise<void>
  toggleSetComplete: (setId: string) => Promise<void>
  removeSet: (setId: string) => Promise<void>
  setRestSeconds: (workoutExerciseId: string, seconds: number) => Promise<void>
  startRest: (workoutExerciseId: string, seconds?: number) => void
  stopRest: () => void
  adjustRest: (deltaSeconds: number) => void
  finishCurrentWorkout: (notes?: string | null) => Promise<void>
  discardCurrentWorkout: () => Promise<void>
  updateSettings: (patch: Partial<Settings>) => Promise<void>
}

const Ctx = createContext<ContextValue | null>(null)

export function WorkoutProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const stateRef = useRef(state)
  stateRef.current = state

  // Hydrate from DB on mount: pull settings + any in-progress workout.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [settings, wip] = await Promise.all([loadSettings(), findInProgressWorkout()])
      if (cancelled) return
      if (wip) {
        const snap = await loadWorkoutSnapshot(wip.id)
        if (cancelled) return
        dispatch({
          type: 'HYDRATED',
          settings,
          workout: snap?.workout ?? null,
          exercises: snap?.exercises ?? [],
        })
      } else {
        dispatch({ type: 'HYDRATED', settings, workout: null, exercises: [] })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const refreshExercises = useCallback(async (workoutId: string) => {
    const snap = await loadWorkoutSnapshot(workoutId)
    dispatch({ type: 'SET_EXERCISES', exercises: snap?.exercises ?? [] })
  }, [])

  const startWorkout: ContextValue['startWorkout'] = useCallback(async (name = null) => {
    const w = await createWorkout(name)
    dispatch({ type: 'SET_WORKOUT', workout: w, exercises: [] })
  }, [])

  const addExercise: ContextValue['addExercise'] = useCallback(async (exercise) => {
    const workout = stateRef.current.workout
    if (!workout) return
    await addExerciseToWorkout(workout.id, exercise)
    const snap = await loadWorkoutSnapshot(workout.id)
    dispatch({ type: 'SET_EXERCISES', exercises: snap?.exercises ?? [] })
    // Focus first incomplete set of the newly added exercise if nothing is focused.
    const next = snap?.exercises.find((e) => e.exercise.id === exercise.id)
    if (next && !stateRef.current.focus) {
      const firstOpen = next.sets.find((s) => s.completed_at == null)
      if (firstOpen) {
        dispatch({ type: 'SET_FOCUS', focus: { workoutExerciseId: next.we.id, setId: firstOpen.id } })
      }
    }
  }, [])

  const removeExercise: ContextValue['removeExercise'] = useCallback(async (id) => {
    const workout = stateRef.current.workout
    if (!workout) return
    await removeWorkoutExercise(id)
    await refreshExercises(workout.id)
    if (stateRef.current.focus?.workoutExerciseId === id) {
      dispatch({ type: 'SET_FOCUS', focus: null })
    }
    if (stateRef.current.rest?.workoutExerciseId === id) {
      dispatch({ type: 'STOP_REST' })
    }
  }, [refreshExercises])

  const addNewSet: ContextValue['addNewSet'] = useCallback(async (weId) => {
    const workout = stateRef.current.workout
    if (!workout) return
    await addSet(weId)
    await refreshExercises(workout.id)
  }, [refreshExercises])

  const patchSet: ContextValue['patchSet'] = useCallback(async (setId, patch) => {
    await updateSet(setId, patch)
    const workout = stateRef.current.workout
    if (workout) await refreshExercises(workout.id)
  }, [refreshExercises])

  const removeSet: ContextValue['removeSet'] = useCallback(async (setId) => {
    await deleteSet(setId)
    const workout = stateRef.current.workout
    if (workout) await refreshExercises(workout.id)
  }, [refreshExercises])

  const startRest: ContextValue['startRest'] = useCallback((weId, seconds) => {
    const we = stateRef.current.exercises.find((e) => e.we.id === weId)
    if (!we) return
    const dur = seconds ?? we.we.rest_seconds
    if (dur <= 0) return
    dispatch({
      type: 'START_REST',
      rest: { workoutExerciseId: weId, endsAt: Date.now() + dur * 1000, totalSeconds: dur },
    })
  }, [])

  const stopRest: ContextValue['stopRest'] = useCallback(() => {
    dispatch({ type: 'STOP_REST' })
  }, [])

  const adjustRest: ContextValue['adjustRest'] = useCallback((delta) => {
    dispatch({ type: 'ADJUST_REST', deltaSeconds: delta })
  }, [])

  const setRestSeconds: ContextValue['setRestSeconds'] = useCallback(async (weId, seconds) => {
    await updateWorkoutExerciseRest(weId, seconds)
    const workout = stateRef.current.workout
    if (workout) await refreshExercises(workout.id)
  }, [refreshExercises])

  const toggleSetComplete: ContextValue['toggleSetComplete'] = useCallback(async (setId) => {
    const { exercises, settings, workout } = stateRef.current
    if (!workout) return
    const target = findSet(exercises, setId)
    if (!target) return
    const { we, set } = target
    const wasCompleted = set.completed_at != null
    const now = Date.now()

    await updateSet(setId, {
      completed_at: wasCompleted ? null : now,
      // Also flush target values into actuals when marking complete, if actuals are empty.
      actual_reps: wasCompleted
        ? null
        : set.actual_reps ?? set.target_reps ?? null,
      actual_weight_kg: wasCompleted
        ? null
        : set.actual_weight_kg ?? set.target_weight_kg ?? null,
    })
    await refreshExercises(workout.id)

    if (wasCompleted) {
      // Unchecking: stop any active timer for this exercise.
      if (stateRef.current.rest?.workoutExerciseId === we.id) dispatch({ type: 'STOP_REST' })
      return
    }

    // Just completed: haptic + optional auto rest timer + optional focus advance.
    if (settings.hapticsOnCompletion) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    }

    if (settings.autoStartRestTimer && we.rest_seconds > 0) {
      dispatch({
        type: 'START_REST',
        rest: {
          workoutExerciseId: we.id,
          endsAt: now + we.rest_seconds * 1000,
          totalSeconds: we.rest_seconds,
        },
      })
    }

    if (settings.autoAdvanceFocus) {
      const next = findNextIncompleteSet(stateRef.current.exercises, we.id, set.position)
      dispatch({ type: 'SET_FOCUS', focus: next })
    }
  }, [refreshExercises])

  const finishCurrentWorkout: ContextValue['finishCurrentWorkout'] = useCallback(async (notes = null) => {
    const workout = stateRef.current.workout
    if (!workout) return
    await finishWorkout(workout.id, notes)
    dispatch({ type: 'SET_WORKOUT', workout: null, exercises: [] })
    dispatch({ type: 'STOP_REST' })
  }, [])

  const discardCurrentWorkout: ContextValue['discardCurrentWorkout'] = useCallback(async () => {
    const workout = stateRef.current.workout
    if (!workout) return
    await discardWorkout(workout.id)
    dispatch({ type: 'SET_WORKOUT', workout: null, exercises: [] })
    dispatch({ type: 'STOP_REST' })
  }, [])

  const updateSettings: ContextValue['updateSettings'] = useCallback(async (patch) => {
    const next = await saveSettings(patch)
    dispatch({ type: 'SET_SETTINGS', settings: next })
  }, [])

  const value = useMemo<ContextValue>(
    () => ({
      ...state,
      startWorkout,
      addExercise,
      removeExercise,
      addNewSet,
      patchSet,
      toggleSetComplete,
      removeSet,
      setRestSeconds,
      startRest,
      stopRest,
      adjustRest,
      finishCurrentWorkout,
      discardCurrentWorkout,
      updateSettings,
    }),
    [
      state, startWorkout, addExercise, removeExercise, addNewSet, patchSet,
      toggleSetComplete, removeSet, setRestSeconds, startRest, stopRest,
      adjustRest, finishCurrentWorkout, discardCurrentWorkout, updateSettings,
    ],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useWorkout(): ContextValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('useWorkout must be used inside <WorkoutProvider>')
  return v
}

function findSet(
  exercises: ActiveExercise[],
  setId: string,
): { we: WorkoutExercise; exercise: Exercise; set: WorkoutSet } | null {
  for (const ae of exercises) {
    const s = ae.sets.find((x) => x.id === setId)
    if (s) return { we: ae.we, exercise: ae.exercise, set: s }
  }
  return null
}

// Find the next incomplete set:
// 1. same exercise, later position
// 2. next exercise (by position) with any incomplete set
// 3. wrap: any earlier exercise with an incomplete set
function findNextIncompleteSet(
  exercises: ActiveExercise[],
  fromWeId: string,
  fromPosition: number,
): Focus | null {
  const idx = exercises.findIndex((e) => e.we.id === fromWeId)
  if (idx < 0) return null

  // Same exercise, later position.
  const currentLater = exercises[idx].sets.find(
    (s) => s.position > fromPosition && s.completed_at == null,
  )
  if (currentLater) return { workoutExerciseId: fromWeId, setId: currentLater.id }

  // Later exercises.
  for (let i = idx + 1; i < exercises.length; i++) {
    const open = exercises[i].sets.find((s) => s.completed_at == null)
    if (open) return { workoutExerciseId: exercises[i].we.id, setId: open.id }
  }
  // Wrap around to earlier exercises.
  for (let i = 0; i < idx; i++) {
    const open = exercises[i].sets.find((s) => s.completed_at == null)
    if (open) return { workoutExerciseId: exercises[i].we.id, setId: open.id }
  }
  return null
}
