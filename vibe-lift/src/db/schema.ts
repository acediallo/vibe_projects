export const SCHEMA_VERSION = 1

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS exercises (
  id                   TEXT PRIMARY KEY,
  name                 TEXT NOT NULL UNIQUE,
  muscle_group         TEXT NOT NULL,
  equipment            TEXT NOT NULL,
  default_rest_seconds INTEGER NOT NULL DEFAULT 90,
  is_bodyweight        INTEGER NOT NULL DEFAULT 0,
  is_custom            INTEGER NOT NULL DEFAULT 0,
  notes                TEXT,
  archived_at          INTEGER
);

CREATE TABLE IF NOT EXISTS workouts (
  id          TEXT PRIMARY KEY,
  name        TEXT,
  started_at  INTEGER NOT NULL,
  ended_at    INTEGER,
  notes       TEXT
);

CREATE TABLE IF NOT EXISTS workout_exercises (
  id             TEXT PRIMARY KEY,
  workout_id     TEXT NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  exercise_id    TEXT NOT NULL REFERENCES exercises(id),
  position       INTEGER NOT NULL,
  rest_seconds   INTEGER NOT NULL DEFAULT 90,
  superset_group INTEGER
);

CREATE TABLE IF NOT EXISTS workout_sets (
  id                   TEXT PRIMARY KEY,
  workout_exercise_id  TEXT NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE,
  position             INTEGER NOT NULL,
  set_type             TEXT NOT NULL DEFAULT 'working',
  target_reps          INTEGER,
  target_weight_kg     REAL,
  actual_reps          INTEGER,
  actual_weight_kg     REAL,
  completed_at         INTEGER
);

CREATE INDEX IF NOT EXISTS idx_we_workout ON workout_exercises(workout_id, position);
CREATE INDEX IF NOT EXISTS idx_ws_we      ON workout_sets(workout_exercise_id, position);
CREATE INDEX IF NOT EXISTS idx_w_started  ON workouts(started_at DESC);
`
