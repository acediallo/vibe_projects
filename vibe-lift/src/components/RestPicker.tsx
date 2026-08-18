import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { theme } from '@/lib/theme'
import { formatRest } from '@/lib/format'

const PRESETS = [30, 45, 60, 75, 90, 120, 150, 180, 210, 240, 300]

interface Props {
  visible: boolean
  initial: number
  onPick: (seconds: number) => void
  onClose: () => void
}

export function RestPicker({ visible, initial, onPick, onClose }: Props) {
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Rest duration</Text>
          <View style={styles.grid}>
            {PRESETS.map((s) => (
              <Pressable
                key={s}
                onPress={() => {
                  onPick(s)
                  onClose()
                }}
                style={[styles.cell, s === initial && styles.cellActive]}
              >
                <Text style={[styles.cellText, s === initial && styles.cellTextActive]}>
                  {formatRest(s)}
                </Text>
              </Pressable>
            ))}
            <Pressable
              onPress={() => {
                onPick(0)
                onClose()
              }}
              style={[styles.cell, initial === 0 && styles.cellActive]}
            >
              <Text style={[styles.cellText, initial === 0 && styles.cellTextActive]}>Off</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: theme.bgElevated,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 32,
  },
  title: { color: theme.text, fontSize: 18, fontWeight: '700', marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.bgInput,
    minWidth: 68,
    alignItems: 'center',
  },
  cellActive: { backgroundColor: theme.accent, borderColor: theme.accent },
  cellText: { color: theme.text, fontWeight: '600' },
  cellTextActive: { color: '#fff' },
})
