import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { DEFAULT_MODEL_BY_PROVIDER } from './constants';
import { useBooksmartStore } from './store';
import { useToastStore } from './toast-store';
import type { AIProvider, AutoScanInterval } from './types';

const PROVIDERS: { value: AIProvider; label: string }[] = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'gemini', label: 'Google Gemini' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'groq', label: 'Groq' },
];

const SCHEDULES: { value: AutoScanInterval; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'manual', label: 'Manual' },
];

interface TestResult {
  ok: boolean;
  message: string;
}

export default function SettingsForm() {
  const settings = useBooksmartStore((s) => s.settings);
  const saveSettings = useBooksmartStore((s) => s.saveSettings);
  const clearAllData = useBooksmartStore((s) => s.clearAllData);

  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  function changeProvider(provider: AIProvider): void {
    void saveSettings({
      aiProvider: provider,
      aiModel: DEFAULT_MODEL_BY_PROVIDER[provider],
    });
    setTestResult(null);
  }

  async function testKey(): Promise<void> {
    if (!settings.aiApiKey) return;
    const pushToast = useToastStore.getState().push;
    setTesting(true);
    setTestResult(null);
    try {
      const resp = (await chrome.runtime.sendMessage({
        type: 'TEST_API_KEY',
        provider: settings.aiProvider,
        apiKey: settings.aiApiKey,
        model: settings.aiModel,
      })) as { ok: boolean; error?: string } | undefined;
      if (resp?.ok) {
        setTestResult({ ok: true, message: 'API key verified.' });
        pushToast('API key verified successfully', 'success');
      } else {
        const msg = resp?.error ?? 'Could not verify the key.';
        setTestResult({ ok: false, message: msg });
        pushToast(msg, 'error');
      }
    } catch (err) {
      const msg = String(err);
      setTestResult({ ok: false, message: msg });
      pushToast(msg, 'error');
    } finally {
      setTesting(false);
    }
  }

  async function handleClear(): Promise<void> {
    const confirmed = window.confirm(
      'Clear all Booksmart metadata? Your actual bookmarks will NOT be deleted.',
    );
    if (confirmed) {
      await clearAllData();
      useToastStore.getState().push('All Booksmart data cleared', 'info');
    }
  }

  return (
    <div className="space-y-6">
      <section>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          AI Provider
        </label>
        <select
          value={settings.aiProvider}
          onChange={(e) => changeProvider(e.target.value as AIProvider)}
          className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded bg-white focus:outline-none focus:border-accent"
        >
          {PROVIDERS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </section>

      <section>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Model
        </label>
        <input
          type="text"
          value={settings.aiModel}
          onChange={(e) => void saveSettings({ aiModel: e.target.value })}
          className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:border-accent font-mono"
        />
      </section>

      <section>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          API Key
        </label>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={settings.aiApiKey ?? ''}
              onChange={(e) => {
                const v = e.target.value;
                void saveSettings({ aiApiKey: v === '' ? null : v });
                setTestResult(null);
              }}
              placeholder="sk-..."
              className="w-full pl-2 pr-8 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:border-accent font-mono"
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              title={showKey ? 'Hide key' : 'Show key'}
            >
              {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <button
            type="button"
            disabled={!settings.aiApiKey || testing}
            onClick={() => void testKey()}
            className="px-3 py-1.5 text-sm rounded bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {testing ? 'Testing…' : 'Test Key'}
          </button>
        </div>
        {testResult && (
          <p
            className={`mt-2 text-xs ${
              testResult.ok ? 'text-status-alive' : 'text-status-dead'
            }`}
          >
            {testResult.message}
          </p>
        )}
        <p className="mt-1 text-xs text-slate-500">
          Stored locally in this extension. Never synced.
        </p>
      </section>

      <section>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Auto-Scan Schedule
        </label>
        <div className="flex gap-3">
          {SCHEDULES.map((s) => (
            <label
              key={s.value}
              className="flex items-center gap-1.5 text-sm cursor-pointer"
            >
              <input
                type="radio"
                name="schedule"
                value={s.value}
                checked={settings.autoScanInterval === s.value}
                onChange={() =>
                  void saveSettings({ autoScanInterval: s.value })
                }
                className="accent-accent"
              />
              {s.label}
            </label>
          ))}
        </div>
      </section>

      <section>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Stale Threshold:{' '}
          <span className="text-slate-500 font-normal">
            {settings.staleThresholdDays} days
          </span>
        </label>
        <input
          type="range"
          min={30}
          max={365}
          step={1}
          value={settings.staleThresholdDays}
          onChange={(e) =>
            void saveSettings({ staleThresholdDays: Number(e.target.value) })
          }
          className="w-full accent-accent"
        />
      </section>

      <section className="border-t border-slate-200 pt-4">
        <h3 className="text-sm font-semibold text-status-dead mb-2">
          Danger Zone
        </h3>
        <button
          type="button"
          onClick={() => void handleClear()}
          className="px-3 py-1.5 text-sm rounded border border-status-dead text-status-dead hover:bg-status-dead hover:text-white"
        >
          Clear all Booksmart data
        </button>
        <p className="mt-1 text-xs text-slate-500">
          Removes scan metadata only. Your actual bookmarks stay put.
        </p>
      </section>
    </div>
  );
}
