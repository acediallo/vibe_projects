import { useCallback, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { Play, RotateCcw } from 'lucide-react-native'
import { theme } from '@/lib/theme'
import { formatDate, formatDuration } from '@/lib/format'
import { listFinishedWorkouts } from '@/db/workouts'
import type { Workout } from '@/db/types'
import { useWorkout } from '@/context/WorkoutContext'

export default function HomeScreen() {
  const router = useRouter()
  const { workout: active, startWorkout, hydrated } = useWorkout()
  const [recent, setRecent] = useState<Workout[]>([])
  const [loading, setLoading] = useState(true)

  useFocusEffect(
    useCallback(() => {
      let cancelled = false
      setLoading(true)
      listFinishedWorkouts(5).then((rows) => {
        if (!cancelled) {
          setRecent(rows)
          setLoading(false)
        }
      })
      return () => {
        cancelled = true
      }
    }, []),
  )

  const beginWorkout = async () => {
    if (!active) await startWorkout(null)
    router.push('/workout/active')
  }

  if (!hydrated) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={theme.accent} />
      </View>
    )
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.hi}>Ready to lift?</Text>
      <Text style={styles.sub}>
        Auto rest timer & auto exercise switch are on by default. Change them in Settings.
      </Text>

      <Pressable style={styles.primary} onPress={beginWorkout}>
        {active ? <RotateCcw size={20} color="#fff" /> : <Play size={20} color="#fff" />}
        <Text style={styles.primaryText}>
          {active ? 'Resume workout' : 'Start empty workout'}
        </Text>
      </Pressable>

      <Text style={styles.section}>Recent</Text>
      {loading && <ActivityIndicator color={theme.textDim} />}
      {!loading && recent.length === 0 && (
        <Text style={styles.empty}>No workouts yet — your first is one tap away.</Text>
      )}
      {recent.map((w) => (
        <Pressable
          key={w.id}
          onPress={() => router.push(`/history/${w.id}`)}
          style={styles.card}
        >
          <Text style={styles.cardTitle}>{w.name || 'Workout'}</Text>
          <Text style={styles.cardMeta}>{formatDate(w.started_at)}</Text>
          {w.ended_at && (
            <Text style={styles.cardMeta}>
              Duration: {formatDuration((w.ended_at - w.started_at) / 1000)}
            </Text>
          )}
        </Pressable>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { padding: 20, paddingBottom: 40 },
  hi: { color: theme.text, fontSize: 28, fontWeight: '800' },
  sub: { color: theme.textDim, marginTop: 4, marginBottom: 20 },
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.accent,
    paddingVertical: 16,
    borderRadius: 12,
  },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  section: {
    color: theme.textDim,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 28,
    marginBottom: 10,
  },
  empty: { color: theme.textFaint },
  card: {
    backgroundColor: theme.bgCard,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  cardTitle: { color: theme.text, fontSize: 16, fontWeight: '700' },
  cardMeta: { color: theme.textDim, fontSize: 12, marginTop: 2 },
})
