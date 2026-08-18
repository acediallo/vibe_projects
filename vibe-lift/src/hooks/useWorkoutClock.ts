import { useEffect, useState } from 'react'
import { useWorkout } from '@/context/WorkoutContext'

// Live elapsed-time counter for the header of the active workout screen.
export function useWorkoutClock(): number {
  const { workout } = useWorkout()
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (!workout) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [workout])

  if (!workout) return 0
  return Math.max(0, Math.floor((now - workout.started_at) / 1000))
}
