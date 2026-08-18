import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { Check } from 'lucide-react-native'
import type { WorkoutSet } from '@/db/types'
import { theme } from '@/lib/theme'
import { useWorkout } from '@/context/WorkoutContext'

interface Props {
  set: WorkoutSet
  index: number
  focused: boolean
}

export function SetRow({ set, index, focused }: Props) {
  const { patchSet, toggleSetComplete } = useWorkout()
  const [weight, setWeight] = useState(fmt(set.target_weight_kg))
  const [reps, setReps] = useState(fmt(set.target_reps))

  useEffect(() => setWeight(fmt(set.target_weight_kg)), [set.target_weight_kg])
  useEffect(() => setReps(fmt(set.target_reps)), [set.target_reps])

  const completed = set.completed_at != null

  const commitWeight = () => {
    const v = parseNum(weight)
    if (v !== set.target_weight_kg) patchSet(set.id, { target_weight_kg: v })
  }
  const commitReps = () => {
    const v = parseNum(reps)
    if (v !== set.target_reps) patchSet(set.id, { target_reps: v == null ? null : Math.round(v) })
  }

  return (
    <View
      style={[
        styles.row,
        focused && styles.rowFocused,
        completed && styles.rowCompleted,
      ]}
    >
      <Text style={styles.index}>{index + 1}</Text>

      <TextInput
        value={weight}
        onChangeText={setWeight}
        onBlur={commitWeight}
        placeholder="—"
        placeholderTextColor={theme.textFaint}
        keyboardType="decimal-pad"
        style={[styles.input, completed && styles.inputCompleted]}
      />
      <Text style={styles.x}>×</Text>
      <TextInput
        value={reps}
        onChangeText={setReps}
        onBlur={commitReps}
        placeholder="—"
        placeholderTextColor={theme.textFaint}
        keyboardType="number-pad"
        style={[styles.input, completed && styles.inputCompleted]}
      />

      <Pressable
        onPress={() => toggleSetComplete(set.id)}
        style={[styles.check, completed && styles.checkOn]}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={completed ? 'Mark set incomplete' : 'Mark set complete'}
      >
        <Check size={18} color={completed ? '#fff' : theme.textFaint} />
      </Pressable>
    </View>
  )
}

function fmt(n: number | null | undefined): string {
  if (n == null) return ''
  return String(n)
}
function parseNum(s: string): number | null {
  const t = s.trim().replace(',', '.')
  if (!t) return null
  const v = Number(t)
  return Number.isFinite(v) ? v : null
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 6,
    gap: 6,
  },
  rowFocused: {
    backgroundColor: theme.bgElevated,
    borderWidth: 1,
    borderColor: theme.accent,
  },
  rowCompleted: {
    opacity: 0.75,
  },
  index: {
    width: 22,
    color: theme.textDim,
    fontWeight: '700',
    textAlign: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: theme.bgInput,
    color: theme.text,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 16,
    fontVariant: ['tabular-nums'],
  },
  inputCompleted: {
    backgroundColor: 'transparent',
  },
  x: {
    color: theme.textFaint,
    fontSize: 14,
    paddingHorizontal: 2,
  },
  check: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: {
    backgroundColor: theme.success,
    borderColor: theme.success,
  },
})
