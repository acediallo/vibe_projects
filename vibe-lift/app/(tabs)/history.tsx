import { useCallback, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { FlatList } from 'react-native-gesture-handler'
import { useFocusEffect, useRouter } from 'expo-router'
import { theme } from '@/lib/theme'
import { formatDate, formatDuration } from '@/lib/format'
import { listFinishedWorkouts } from '@/db/workouts'
import type { Workout } from '@/db/types'

export default function HistoryScreen() {
  const router = useRouter()
  const [rows, setRows] = useState<Workout[]>([])
  const [loading, setLoading] = useState(true)

  useFocusEffect(
    useCallback(() => {
      let cancelled = false
      setLoading(true)
      listFinishedWorkouts(200).then((data) => {
        if (cancelled) return
        setRows(data)
        setLoading(false)
      })
      return () => {
        cancelled = true
      }
    }, []),
  )

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.accent} />
      </View>
    )
  }

  if (rows.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>No finished workouts yet.</Text>
      </View>
    )
  }

  return (
    <FlatList
      data={rows}
      keyExtractor={(w) => w.id}
      contentContainerStyle={{ padding: 16 }}
      renderItem={({ item }) => (
        <Pressable
          onPress={() => router.push(`/history/${item.id}`)}
          style={styles.card}
        >
          <Text style={styles.title}>{item.name || 'Workout'}</Text>
          <Text style={styles.meta}>{formatDate(item.started_at)}</Text>
          {item.ended_at && (
            <Text style={styles.meta}>
              {formatDuration((item.ended_at - item.started_at) / 1000)}
            </Text>
          )}
        </Pressable>
      )}
    />
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { color: theme.textFaint },
  card: {
    backgroundColor: theme.bgCard,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  title: { color: theme.text, fontSize: 16, fontWeight: '700' },
  meta: { color: theme.textDim, fontSize: 12, marginTop: 2 },
})
