# Vibe Lift

A personal, offline-first workout tracker for Android. Hevy-inspired, minus the
social / community stuff. Two headline features:

- **Auto rest timer** — starts the moment you check off a set, using that
  exercise's configured rest duration. Deadline-based, so it survives
  backgrounding. Skip / ±15s at any time.
- **Auto exercise switch** — when you finish a set, focus jumps to the next
  incomplete set in the current exercise; when the current exercise is done,
  focus jumps to the next exercise's first open set. Both can be toggled off in
  Settings.

All data lives on-device in SQLite (`expo-sqlite`) — no accounts, no cloud, no
sharing.

## Stack

- Expo SDK 52 + React Native 0.76 + Expo Router 4 (file-based routing)
- `expo-sqlite` for persistence, `expo-haptics` + Vibration for feedback,
  `expo-keep-awake` to keep the screen on during a workout
- TypeScript throughout, single dark theme

## Screens

- **Home** — start / resume workout, recent history
- **Workout (active)** — exercise cards with sets, floating rest-timer bar,
  finish / discard
- **Add exercise** picker
- **History** — past workouts, per-workout detail with volume total
- **Exercises** — searchable library, add custom exercises
- **Settings** — toggle auto-timer, auto-advance, haptics, unit

## Build & run (on your laptop)

You'll need Node 20+, Java 17, and Android Studio (or at least the Android SDK
command-line tools) with the Android SDK installed. `adb` should be on your
`PATH`.

### One-time setup

```bash
cd vibe-lift
npm install
npx expo install --check     # aligns package versions to the Expo SDK
```

### Live dev on a device (fastest to iterate)

```bash
npm run start                # then press "a" to open on Android, or scan the QR
```

You'll need Expo Go from the Play Store, or once you `prebuild` (below) you can
build a dev client instead.

### Build an installable APK (personal use)

Native build via EAS, locally — no Expo account or paid tier needed for local
builds, but you do need the Android SDK.

```bash
npm install -g eas-cli
eas build -p android --profile preview --local
```

That produces `build-*.apk` in the project root. Copy it to your phone (USB,
Drive, whatever) and install — you'll need "Install unknown apps" enabled for
the source app.

If you'd rather skip EAS entirely, you can run the native Gradle build directly:

```bash
npx expo prebuild -p android    # generates the android/ folder
cd android
./gradlew assembleRelease       # apk in android/app/build/outputs/apk/release/
```

Sign it with the auto-generated debug keystore for personal use, or generate
your own via `keytool` if you want reproducible signing.

### Install on your phone

```bash
adb install path/to/vibe-lift.apk
```

## Data location

SQLite database lives at
`file:///data/data/com.vibelift.personal/databases/vibe-lift.db`
inside the app's sandbox. To back it up, pull it via `adb`:

```bash
adb exec-out run-as com.vibelift.personal cat databases/vibe-lift.db > backup.db
```

Not for release Play Store builds (`run-as` only works on debuggable ones), but
fine for the personal APK.

## Extending

- `src/data/seed-exercises.ts` — the starter library. Add your favorites here,
  or use the in-app "New exercise" form (survives DB seeding, since seeding
  only runs when the exercises table is empty).
- Auto-advance rule lives in `findNextIncompleteSet` in
  `src/context/WorkoutContext.tsx` — currently: next set in same exercise →
  next exercise → wrap around. Change it here for e.g. superset alternation.
- Rest timer default duration per exercise is stored on the `exercises` row and
  copied into each workout entry when you add it, so tweaking defaults doesn't
  retroactively change history.

## What's intentionally missing

- Sharing / social / feed / friends
- Cloud sync / accounts / login
- Charts (skeleton is there — `volume` is computed on the history detail page;
  add `victory-native` or similar if you want graphs)
- Photos, videos, exercise thumbnails
- Programs / routines templates (the tables support ordering via `position`,
  so adding a `routines` table + copy-to-workout is straightforward later)
