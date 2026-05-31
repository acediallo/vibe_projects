# Cadence — Personal Time-Tracking Assistant (Android)

Cadence helps you see where your day actually goes and whether it matches your plan.
It periodically checks in ("What are you doing right now?"), lets you log the moment
against a category, and compares your **actual** logged time against a **baseline**
(your device calendar + per-category daily goals).

This is **Phase 1** (the core app). An on-device Gemma assistant is planned for Phase 2.

## Features

- **Scheduled check-in prompts** via notifications, with one-tap category buttons.
- **Categories & daily goals** — create buckets (e.g. "PMP Study"), set a daily minute
  goal, watch progress bars fill.
- **Plan vs Actual** — today's calendar events shown as the baseline; idle / unaccounted
  time highlighted.
- **Today dashboard** — per-category totals, goal progress, recent check-ins.
- 100% on-device, no account, no backend.

## How it's built

- Kotlin + Jetpack Compose (Material 3)
- Room (local DB), DataStore (settings), WorkManager (periodic prompts)
- Device calendar via `CalendarContract`
- minSdk 26 (Android 8.0), targetSdk 35

## Getting the APK

### Option A — GitHub Actions (no local setup)

1. Push to a `claude/**` branch (or run the **Build Cadence APK** workflow manually).
2. Open the workflow run → **Artifacts** → download `cadence-debug-apk`.
3. Copy `app-debug.apk` to your phone and install (enable *Install unknown apps* for
   your file manager / browser).

### Option B — build locally

Requires the Android SDK (e.g. via Android Studio):

```bash
cd cadence
./gradlew assembleDebug
# APK at app/build/outputs/apk/debug/app-debug.apk
```

Run unit tests:

```bash
./gradlew testDebugUnitTest
```

## First run

1. Grant **notifications** and **calendar** permissions when prompted.
2. In **Settings**, pick your check-in interval and active hours, and choose which
   calendars to include.
3. In **Goals**, adjust categories and set daily goals.
4. Wait for a check-in notification (or tap **Log now** on Today) and pick a category.

> WorkManager's minimum periodic interval is 15 minutes, so the most frequent prompt
> cadence is every 15 minutes.

## Roadmap (Phase 2)

- On-device **Gemma 3n / 2B** (MediaPipe LLM Inference), downloaded on first launch.
- Auto-classify free-text check-in answers into categories.
- End-of-day reflection comparing plan vs actual and suggesting adjustments.
