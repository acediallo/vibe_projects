import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { FlatList } from 'react-native-gesture-handler'
import { useRouter } from 'expo-router'
import { Search } from 'lucide-react-native'
import { listExercises } from '@/db/exercises'
import type { Exercise } from '@/db/types'
import { theme } from '@/lib/theme'
import { useWorkout } from '@/context/WorkoutContext'

export default function ExercisePickerScreen() {
  const router = useRouter()
  const { addExercise } = useWorkout()
  const [rows, setRows] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  useEffect(() => {
    let cancelled = false
    listExercises().then((data) => {
      if (cancelled) return
      setRows(data)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.muscle_group.toLowerCase().includes(q) ||
        r.equipment.toLowerCase().includes(q),
    )
  }, [rows, query])

  const pick = async (e: Exercise) => {
    await addExercise(e)
    router.back()
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.searchWrap}>
        <Search size={16} color={theme.textDim} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search exercises"
          placeholderTextColor={theme.textFaint}
          style={styles.search}
          autoFocus
        />
      </View>

      {loading ? (
        <ActivityIndicator color={theme.accent} style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(e) => e.id}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <Pressable onPress={() => pick(item)} style={styles.item}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.meta}>
                {item.muscle_group} · {item.equipment}
              </Text>
            </Pressable>
          )}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.bgInput,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  search: { flex: 1, paddingVertical: 10, color: theme.text },
  item: {
    backgroundColor: theme.bgCard,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  name: { color: theme.text, fontWeight: '600' },
  meta: { color: theme.textDim, fontSize: 12, marginTop: 2 },
})
