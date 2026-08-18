import * as SQLite from 'expo-sqlite'
import { SCHEMA_SQL, SCHEMA_VERSION } from './schema'
import { SEED_EXERCISES } from '@/data/seed-exercises'
import { newId } from '@/lib/id'

const DB_NAME = 'vibe-lift.db'

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) dbPromise = init()
  return dbPromise
}

async function init(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DB_NAME)
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;')
  await db.execAsync(SCHEMA_SQL)

  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM meta WHERE key = 'schema_version'"
  )
  const current = row ? Number(row.value) : 0
  if (current < SCHEMA_VERSION) {
    await db.runAsync(
      "INSERT OR REPLACE INTO meta(key, value) VALUES ('schema_version', ?)",
      String(SCHEMA_VERSION)
    )
  }

  const seeded = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM exercises'
  )
  if (!seeded || seeded.n === 0) {
    await db.withTransactionAsync(async () => {
      for (const ex of SEED_EXERCISES) {
        await db.runAsync(
          `INSERT INTO exercises
             (id, name, muscle_group, equipment, default_rest_seconds, is_bodyweight, is_custom, notes)
           VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
          newId(),
          ex.name,
          ex.muscle_group,
          ex.equipment,
          ex.default_rest_seconds,
          ex.is_bodyweight,
          ex.notes,
        )
      }
    })
  }
  return db
}
