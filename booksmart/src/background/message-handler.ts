import { STORAGE_KEYS } from '@shared/constants';
import type { BackgroundMessage, ScanProgress } from '@shared/types';
import { rescanIds, startScan } from './bookmark-scanner';
import { enrichAll } from './history-enricher';

const NOT_IMPLEMENTED = {
  ok: false,
  error: 'AI features not implemented yet (phase 4).',
} as const;

export function registerMessageHandler(): void {
  chrome.runtime.onMessage.addListener((raw, _sender, sendResponse) => {
    const msg = raw as BackgroundMessage;
    route(msg)
      .then(sendResponse)
      .catch((err: unknown) => {
        sendResponse({ ok: false, error: String(err) });
      });
    return true;
  });
}

async function route(msg: BackgroundMessage): Promise<unknown> {
  switch (msg.type) {
    case 'START_SCAN':
      void runScanAndEnrich();
      return { ok: true };
    case 'RECHECK_IDS':
      void rescanIds(msg.ids);
      return { ok: true };
    case 'GET_PROGRESS': {
      const got = await chrome.storage.local.get(STORAGE_KEYS.scanProgress);
      const progress: ScanProgress = (got[STORAGE_KEYS.scanProgress] as ScanProgress) ?? {
        isScanning: false,
        total: 0,
        checked: 0,
        currentUrl: null,
        startedAt: null,
      };
      return { ok: true, progress };
    }
    case 'REQUEST_REORG':
    case 'APPLY_SUGGESTION':
    case 'TEST_API_KEY':
      return NOT_IMPLEMENTED;
  }
}

async function runScanAndEnrich(): Promise<void> {
  await startScan();
  await enrichAll();
}
