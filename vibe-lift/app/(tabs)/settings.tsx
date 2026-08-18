import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native'
import { theme } from '@/lib/theme'
import { useWorkout } from '@/context/WorkoutContext'

export default function SettingsScreen() {
  const { settings, updateSettings } = useWorkout()

  const rows: { key: keyof typeof settings; label: string; hint?: string }[] = [
    { key: 'autoStartRestTimer', label: 'Auto-start rest timer', hint: 'When you check off a set' },
    { key: 'autoAdvanceFocus',   label: 'Auto-advance to next set', hint: 'Jump focus to the next incomplete set / next exercise' },
    { key: 'hapticsOnCompletion', label: 'Haptics on set complete' },
    { key: 'soundOnRestEnd',      label: 'Sound when rest ends' },
  ]

  return (
    <ScrollView contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.section}>Workout automation</Text>
      {rows.map((r) => (
        <View key={r.key} style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>{r.label}</Text>
            {r.hint && <Text style={styles.hint}>{r.hint}</Text>}
          </View>
          <Switch
            value={Boolean(settings[r.key])}
            onValueChange={(v) => updateSettings({ [r.key]: v } as Partial<typeof settings>)}
            trackColor={{ false: theme.border, true: theme.accentDim }}
            thumbColor={theme.text}
          />
        </View>
      ))}

      <Text style={[styles.section, { marginTop: 28 }]}>Units</Text>
      <View style={styles.row}>
        <Text style={styles.label}>Weight unit</Text>
        <View style={styles.pickerRow}>
          {(['kg', 'lb'] as const).map((u) => (
            <Text
              key={u}
              onPress={() => updateSettings({ weightUnit: u })}
              style={[styles.chip, settings.weightUnit === u && styles.chipActive]}
            >
              {u}
            </Text>
          ))}
        </View>
      </View>

      <Text style={[styles.section, { marginTop: 28 }]}>About</Text>
      <Text style={styles.hint}>
        Vibe Lift — personal build. Data lives on this device only (SQLite).
      </Text>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  section: {
    color: theme.textDim,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.bgCard,
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
    gap: 12,
  },
  label: { color: theme.text, fontWeight: '600' },
  hint: { color: theme.textDim, fontSize: 12, marginTop: 2 },
  pickerRow: { flexDirection: 'row', gap: 6 },
  chip: {
    color: theme.textDim,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: theme.bgInput,
    overflow: 'hidden',
    fontWeight: '700',
  },
  chipActive: { color: '#fff', backgroundColor: theme.accent },
})
