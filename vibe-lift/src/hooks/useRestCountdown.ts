import { useEffect, useRef, useState } from 'react'
import { Vibration } from 'react-native'
import * as Haptics from 'expo-haptics'
import { useWorkout } from '@/context/WorkoutContext'

// Deadline-based countdown that survives backgrounding — the timer records
// endsAt on start, we just recompute (endsAt - Date.now()) on each tick.
export function useRestCountdown(): { remaining: number; total: number; active: boolean } {
  const { rest, stopRest, settings } = useWorkout()
  const [remaining, setRemaining] = useState(0)
  const firedRef = useRef(false)

  useEffect(() => {
    if (!rest) {
      setRemaining(0)
      firedRef.current = false
      return
    }
    firedRef.current = false

    const tick = () => {
      const ms = rest.endsAt - Date.now()
      const secs = Math.max(0, Math.ceil(ms / 1000))
      setRemaining(secs)
      if (secs <= 0 && !firedRef.current) {
        firedRef.current = true
        Vibration.vibrate([0, 200, 100, 400])
        if (settings.hapticsOnCompletion) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
        }
        setTimeout(() => stopRest(), 400)
      }
    }
    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [rest, stopRest, settings.hapticsOnCompletion])

  return {
    remaining,
    total: rest?.totalSeconds ?? 0,
    active: !!rest,
  }
}
