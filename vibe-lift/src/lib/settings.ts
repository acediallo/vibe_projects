import { getDb } from '@/db'

export interface Settings {
  autoStartRestTimer: boolean
  autoAdvanceFocus: boolean
  hapticsOnCompletion: boolean
  soundOnRestEnd: boolean
  weightUnit: 'kg' | 'lb'
}

export const DEFAULT_SETTINGS: Settings = {
  autoStartRestTimer: true,
  autoAdvanceFocus: true,
  hapticsOnCompletion: true,
  soundOnRestEnd: true,
  weightUnit: 'kg',
}

const KEY = 'settings.v1'

export async function loadSettings(): Promise<Settings> {
  const db = await getDb()
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM meta WHERE key = ?',
    KEY,
  )
  if (!row) return DEFAULT_SETTINGS
  try {
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(row.value) as Partial<Settings>) }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const current = await loadSettings()
  const next: Settings = { ...current, ...patch }
  const db = await getDb()
  await db.runAsync(
    'INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)',
    KEY,
    JSON.stringify(next),
  )
  return next
}
