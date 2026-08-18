import { useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useKeepAwake } from 'expo-keep-awake'
import { CheckCircle2, Plus, Trash2 } from 'lucide-react-native'
import { theme } from '@/lib/theme'
import { useWorkout } from '@/context/WorkoutContext'
import { useWorkoutClock } from '@/hooks/useWorkoutClock'
import { formatDuration } from '@/lib/format'
import { ExerciseCard } from '@/components/ExerciseCard'
import { RestTimerBar } from '@/components/RestTimerBar'
import { RestPicker } from '@/components/RestPicker'

export default function ActiveWorkoutScreen() {
  useKeepAwake()
  const router = useRouter()
  const {
    workout,
    exercises,
    finishCurrentWorkout,
    discardCurrentWorkout,
    setRestSeconds,
  } = useWorkout()
  const elapsed = useWorkoutClock()
  const [restEditFor, setRestEditFor] = useState<{ id: string; current: number } | null>(null)

  if (!workout) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No workout in progress.</Text>
      </View>
    )
  }

  const anyCompleted = exercises.some((e) => e.sets.some((s) => s.completed_at != null))

  const onFinish = () => {
    Alert.alert('Finish workout?', 'Save this session to history?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Finish',
        onPress: async () => {
          await finishCurrentWorkout()
          router.replace('/')
        },
      },
    ])
  }

  const onDiscard = () => {
    Alert.alert(
      'Discard workout?',
      'All sets from this session will be deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: async () => {
            await discardCurrentWorkout()
            router.replace('/')
          },
        },
      ],
    )
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.header}>
        <Text style={styles.timer}>{formatDuration(elapsed)}</Text>
        <View style={styles.headerActions}>
          <Pressable onPress={onDiscard} style={[styles.hbtn, styles.hbtnGhost]}>
            <Trash2 size={16} color={theme.danger} />
            <Text style={[styles.hbtnText, { color: theme.danger }]}>Discard</Text>
          </Pressable>
          <Pressable
            onPress={onFinish}
            style={[styles.hbtn, anyCompleted ? styles.hbtnPrimary : styles.hbtnGhost]}
            disabled={!anyCompleted}
          >
            <CheckCircle2 size={16} color={anyCompleted ? '#fff' : theme.textFaint} />
            <Text style={[styles.hbtnText, { color: anyCompleted ? '#fff' : theme.textFaint }]}>
              Finish
            </Text>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 180 }}>
        {exercises.length === 0 && (
          <Text style={styles.hint}>Add an exercise to get started.</Text>
        )}
        {exercises.map((item) => (
          <ExerciseCard
            key={item.we.id}
            item={item}
            onEditRest={() => setRestEditFor({ id: item.we.id, current: item.we.rest_seconds })}
          />
        ))}

        <Pressable style={styles.addExercise} onPress={() => router.push('/workout/picker')}>
          <Plus size={18} color={theme.accent} />
          <Text style={styles.addExerciseText}>Add exercise</Text>
        </Pressable>
      </ScrollView>

      <RestTimerBar />

      <RestPicker
        visible={restEditFor != null}
        initial={restEditFor?.current ?? 90}
        onPick={(s) => restEditFor && setRestSeconds(restEditFor.id, s)}
        onClose={() => setRestEditFor(null)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  timer: {
    color: theme.text,
    fontSize: 24,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  headerActions: { flexDirection: 'row', gap: 8 },
  hbtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  hbtnGhost: { borderWidth: 1, borderColor: theme.border },
  hbtnPrimary: { backgroundColor: theme.success },
  hbtnText: { fontWeight: '700', fontSize: 13 },
  hint: { color: theme.textDim, textAlign: 'center', marginTop: 40 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: theme.textDim },
  addExercise: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.border,
    marginTop: 4,
  },
  addExerciseText: { color: theme.accent, fontWeight: '700' },
})
