import { useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useRouter } from 'expo-router'
import { theme } from '@/lib/theme'
import { createExercise } from '@/db/exercises'
import type { Equipment, MuscleGroup } from '@/db/types'

const GROUPS: MuscleGroup[] = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Cardio', 'Other']
const EQUIP: Equipment[] = ['Barbell', 'Dumbbell', 'Cable', 'Machine', 'Bodyweight', 'Kettlebell', 'Band', 'Other']

export default function NewExercise() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [group, setGroup] = useState<MuscleGroup>('Chest')
  const [equipment, setEquipment] = useState<Equipment>('Barbell')
  const [rest, setRest] = useState('90')

  const save = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      Alert.alert('Name required')
      return
    }
    const restNum = Number(rest) || 90
    try {
      await createExercise({
        name: trimmed,
        muscle_group: group,
        equipment,
        default_rest_seconds: restNum,
        is_bodyweight: equipment === 'Bodyweight',
      })
      router.back()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      Alert.alert('Could not save', message)
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.label}>Name</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="e.g. Cable Crossover"
        placeholderTextColor={theme.textFaint}
        style={styles.input}
      />

      <Text style={styles.label}>Muscle group</Text>
      <ChipRow
        options={GROUPS}
        value={group}
        onChange={(v) => setGroup(v as MuscleGroup)}
      />

      <Text style={styles.label}>Equipment</Text>
      <ChipRow
        options={EQUIP}
        value={equipment}
        onChange={(v) => setEquipment(v as Equipment)}
      />

      <Text style={styles.label}>Default rest (seconds)</Text>
      <TextInput
        value={rest}
        onChangeText={setRest}
        keyboardType="number-pad"
        style={styles.input}
      />

      <Pressable style={styles.save} onPress={save}>
        <Text style={styles.saveText}>Save exercise</Text>
      </Pressable>
    </ScrollView>
  )
}

function ChipRow<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly T[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <View style={styles.chips}>
      {options.map((o) => (
        <Pressable
          key={o}
          onPress={() => onChange(o)}
          style={[styles.chip, value === o && styles.chipActive]}
        >
          <Text style={[styles.chipText, value === o && styles.chipTextActive]}>{o}</Text>
        </Pressable>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  label: {
    color: theme.textDim,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 16,
    marginBottom: 8,
  },
  input: {
    backgroundColor: theme.bgInput,
    color: theme.text,
    padding: 12,
    borderRadius: 10,
    fontSize: 16,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: theme.bgInput,
  },
  chipActive: { backgroundColor: theme.accent },
  chipText: { color: theme.text, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  save: {
    marginTop: 28,
    backgroundColor: theme.accent,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 16 },
})
