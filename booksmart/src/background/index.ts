import { handleAlarm, syncAlarmFromSettings } from './alarm-manager';
import { resumeIfPending } from './bookmark-scanner';
import { registerMessageHandler } from './message-handler';
import { STORAGE_KEYS } from '@shared/constants';

registerMessageHandler();

chrome.runtime.onInstalled.addListener(() => {
  void syncAlarmFromSettings();
  void resumeIfPending();
});

chrome.runtime.onStartup.addListener(() => {
  void syncAlarmFromSettings();
  void resumeIfPending();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  void handleAlarm(alarm);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[STORAGE_KEYS.settings]) {
    void syncAlarmFromSettings();
  }
});

void resumeIfPending();
