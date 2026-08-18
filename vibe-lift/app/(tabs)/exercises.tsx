import { useCallback, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { FlatList } from 'react-native-gesture-handler'
import { useFocusEffect, useRouter } from 'expo-router'
import { Plus, Search } from 'lucide-react-native'
import { theme } from '@/lib/theme'
import { listExercises } from '@/db/exercises'
import type { Exercise } from '@/db/types'

export default function ExercisesTab() {
  const [rows, setRows] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const router = useRouter()

  useFocusEffect(
    useCallback(() => {
      let cancelled = false
      setLoading(true)
      listExercises().then((data) => {
        if (cancelled) return
        setRows(data)
        setLoading(false)
      })
      return () => {
        cancelled = true
      }
    }, []),
  )

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
        />
      </View>

      {loading ? (
        <ActivityIndicator color={theme.accent} style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(e) => e.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          renderItem={({ item }) => (
            <View style={styles.item}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.meta}>
                {item.muscle_group} · {item.equipment} · rest {item.default_rest_seconds}s
                {item.is_custom ? ' · custom' : ''}
              </Text>
            </View>
          )}
        />
      )}

      <Pressable style={styles.fab} onPress={() => router.push('/exercises/new')}>
        <Plus size={22} color="#fff" />
      </Pressable>
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
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
})
