import { DEFAULT_SETTINGS, STORAGE_KEYS } from '@shared/constants';
import type { AutoScanInterval, Settings } from '@shared/types';
import { startScan } from './bookmark-scanner';
import { enrichAll } from './history-enricher';

const ALARM_NAME = 'autoScan';

const PERIODS_MIN: Record<Exclude<AutoScanInterval, 'manual'>, number> = {
  daily: 1440,
  weekly: 10080,
};

export async function syncAlarmFromSettings(): Promise<void> {
  const settings = await loadSettings();
  await applyInterval(settings.autoScanInterval);
}

export async function applyInterval(interval: AutoScanInterval): Promise<void> {
  if (interval === 'manual') {
    await chrome.alarms.clear(ALARM_NAME);
    return;
  }
  await chrome.alarms.create(ALARM_NAME, {
    periodInMinutes: PERIODS_MIN[interval],
  });
}

export async function handleAlarm(alarm: chrome.alarms.Alarm): Promise<void> {
  if (alarm.name !== ALARM_NAME) return;
  await startScan();
  await enrichAll();
}

async function loadSettings(): Promise<Settings> {
  const got = await chrome.storage.local.get(STORAGE_KEYS.settings);
  return { ...DEFAULT_SETTINGS, ...((got[STORAGE_KEYS.settings] as Settings) ?? {}) };
}
