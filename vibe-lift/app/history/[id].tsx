import { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { theme } from '@/lib/theme'
import { formatDate, formatDuration } from '@/lib/format'
import { loadWorkoutSnapshot, type ActiveWorkoutSnapshot } from '@/db/workouts'

export default function HistoryDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [snap, setSnap] = useState<ActiveWorkoutSnapshot | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    if (!id) return
    loadWorkoutSnapshot(id).then((s) => {
      if (cancelled) return
      setSnap(s)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [id])

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.accent} />
      </View>
    )
  }
  if (!snap) {
    return (
      <View style={styles.center}>
        <Text style={styles.dim}>Workout not found.</Text>
      </View>
    )
  }

  const dur =
    snap.workout.ended_at != null
      ? formatDuration((snap.workout.ended_at - snap.workout.started_at) / 1000)
      : '—'

  const volume = snap.exercises.reduce((acc, e) => {
    return (
      acc +
      e.sets.reduce((a, s) => {
        if (s.completed_at == null) return a
        const w = s.actual_weight_kg ?? s.target_weight_kg ?? 0
        const r = s.actual_reps ?? s.target_reps ?? 0
        return a + w * r
      }, 0)
    )
  }, 0)

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.title}>{snap.workout.name || 'Workout'}</Text>
      <Text style={styles.meta}>{formatDate(snap.workout.started_at)}</Text>
      <View style={styles.summary}>
        <Stat label="Duration" value={dur} />
        <Stat label="Exercises" value={String(snap.exercises.length)} />
        <Stat label="Volume" value={`${Math.round(volume).toLocaleString()} kg`} />
      </View>

      {snap.exercises.map((ae) => (
        <View key={ae.we.id} style={styles.card}>
          <Text style={styles.exName}>{ae.exercise.name}</Text>
          {ae.sets.map((s, i) => {
            const w = s.actual_weight_kg ?? s.target_weight_kg ?? 0
            const r = s.actual_reps ?? s.target_reps ?? 0
            const done = s.completed_at != null
            return (
              <View key={s.id} style={styles.setLine}>
                <Text style={styles.setIdx}>{i + 1}</Text>
                <Text style={[styles.setVal, !done && styles.setValDim]}>
                  {w ? `${w} kg` : '—'} × {r || '—'}
                </Text>
                {done && <Text style={styles.setDone}>✓</Text>}
              </View>
            )
          })}
        </View>
      ))}
    </ScrollView>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statVal}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  dim: { color: theme.textDim },
  title: { color: theme.text, fontSize: 24, fontWeight: '800' },
  meta: { color: theme.textDim, marginTop: 2 },
  summary: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    marginBottom: 20,
  },
  stat: {
    flex: 1,
    backgroundColor: theme.bgCard,
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  statVal: { color: theme.text, fontSize: 18, fontWeight: '700' },
  statLabel: { color: theme.textDim, fontSize: 11, marginTop: 2 },
  card: {
    backgroundColor: theme.bgCard,
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
  },
  exName: { color: theme.text, fontWeight: '700', fontSize: 16, marginBottom: 8 },
  setLine: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    gap: 12,
  },
  setIdx: { color: theme.textDim, width: 20 },
  setVal: { color: theme.text, flex: 1, fontVariant: ['tabular-nums'] },
  setValDim: { color: theme.textFaint },
  setDone: { color: theme.success, fontWeight: '700' },
})
