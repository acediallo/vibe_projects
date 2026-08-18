import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Minus, Plus, X } from 'lucide-react-native'
import { theme } from '@/lib/theme'
import { formatRest } from '@/lib/format'
import { useWorkout } from '@/context/WorkoutContext'
import { useRestCountdown } from '@/hooks/useRestCountdown'

export function RestTimerBar() {
  const { rest, stopRest, adjustRest, exercises } = useWorkout()
  const { remaining, total, active } = useRestCountdown()
  if (!active || !rest) return null

  const exercise = exercises.find((e) => e.we.id === rest.workoutExerciseId)?.exercise
  const pct = total > 0 ? Math.min(1, Math.max(0, remaining / total)) : 0

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.bar}>
        <View style={styles.header}>
          <Text style={styles.label}>Rest{exercise ? ` · ${exercise.name}` : ''}</Text>
          <Pressable onPress={stopRest} hitSlop={10} accessibilityLabel="Skip rest">
            <X size={18} color={theme.textDim} />
          </Pressable>
        </View>

        <View style={styles.row}>
          <Pressable onPress={() => adjustRest(-15)} style={styles.chip} hitSlop={6}>
            <Minus size={14} color={theme.text} />
            <Text style={styles.chipText}>15s</Text>
          </Pressable>

          <Text style={styles.time}>{formatRest(remaining)}</Text>

          <Pressable onPress={() => adjustRest(15)} style={styles.chip} hitSlop={6}>
            <Plus size={14} color={theme.text} />
            <Text style={styles.chipText}>15s</Text>
          </Pressable>
        </View>

        <View style={styles.track}>
          <View style={[styles.fill, { width: `${pct * 100}%` }]} />
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 12,
  },
  bar: {
    backgroundColor: theme.bgElevated,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.border,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  label: { color: theme.textDim, fontSize: 12, flex: 1, marginRight: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: theme.bgInput,
  },
  chipText: { color: theme.text, fontWeight: '600' },
  time: {
    color: theme.text,
    fontSize: 32,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    minWidth: 90,
    textAlign: 'center',
  },
  track: {
    height: 4,
    backgroundColor: theme.bgInput,
    borderRadius: 999,
    marginTop: 10,
    overflow: 'hidden',
  },
  fill: { height: 4, backgroundColor: theme.accent, borderRadius: 999 },
})
