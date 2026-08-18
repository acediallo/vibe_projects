import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Plus, Timer, X } from 'lucide-react-native'
import { useWorkout, type ActiveExercise } from '@/context/WorkoutContext'
import { SetRow } from './SetRow'
import { theme } from '@/lib/theme'
import { formatRest } from '@/lib/format'

interface Props {
  item: ActiveExercise
  onEditRest: () => void
}

export function ExerciseCard({ item, onEditRest }: Props) {
  const { addNewSet, removeExercise, focus } = useWorkout()

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{item.exercise.name}</Text>
          <Text style={styles.meta}>
            {item.exercise.muscle_group} · {item.exercise.equipment}
          </Text>
        </View>
        <Pressable onPress={onEditRest} style={styles.restBtn} hitSlop={8}>
          <Timer size={14} color={theme.accent} />
          <Text style={styles.restBtnText}>rest {formatRest(item.we.rest_seconds)}</Text>
        </Pressable>
        <Pressable
          onPress={() => removeExercise(item.we.id)}
          style={styles.removeBtn}
          hitSlop={8}
          accessibilityLabel="Remove exercise"
        >
          <X size={16} color={theme.textDim} />
        </Pressable>
      </View>

      <View style={styles.legend}>
        <Text style={[styles.legendText, { width: 22, textAlign: 'center' }]}>#</Text>
        <Text style={[styles.legendText, { flex: 1, textAlign: 'center' }]}>kg</Text>
        <Text style={[styles.legendText, { width: 14 }]} />
        <Text style={[styles.legendText, { flex: 1, textAlign: 'center' }]}>reps</Text>
        <Text style={[styles.legendText, { width: 34, textAlign: 'center' }]}>✓</Text>
      </View>

      {item.sets.map((s, i) => (
        <SetRow
          key={s.id}
          set={s}
          index={i}
          focused={
            focus?.workoutExerciseId === item.we.id && focus?.setId === s.id
          }
        />
      ))}

      <Pressable onPress={() => addNewSet(item.we.id)} style={styles.addSet}>
        <Plus size={16} color={theme.accent} />
        <Text style={styles.addSetText}>Add set</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.bgCard,
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 10 },
  name: { color: theme.text, fontSize: 16, fontWeight: '700' },
  meta: { color: theme.textDim, fontSize: 12, marginTop: 2 },
  restBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
  },
  restBtnText: { color: theme.accent, fontSize: 12, fontWeight: '600' },
  removeBtn: { padding: 4 },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  legendText: { color: theme.textFaint, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  addSet: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.border,
    marginTop: 4,
  },
  addSetText: { color: theme.accent, fontWeight: '600' },
})
