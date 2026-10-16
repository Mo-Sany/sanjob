import { useEffect, useState } from 'preact/hooks';
import { AI_MODELS, API_ORIGIN, loadApiKey, saveApiKey } from '../../claude/api';
import { repo } from '../../db/db';
import { cvFileKind, readCvFile } from '../../match/cvfile';
import { FILTER_PRESETS, parseKeywords } from '../../shared/filter';
import { fmt, type Strings } from '../../shared/i18n';
import type { AiModel, Language, Settings, WindowMode } from '../../shared/types';
import type { Notify } from '../App';
import { send } from '../api';

interface Props {
  t: Strings;
  settings: Settings;
  update: (patch: Partial<Settings>) => Promise<void>;
  notify: Notify;
}

export function SettingsView({ t, settings, update, notify }: Props) {
  const [historySize, setHistorySize] = useState(0);
  const [cv, setCv] = useState(settings.cvText);
  const [words, setWords] = useState(settings.excludeKeywords.join(', '));
  const [reading, setReading] = useState(false);
  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    void repo.historySize().then(setHistorySize);
    void loadApiKey().then(setApiKey);
  }, []);

  useEffect(() => setCv(settings.cvText), [settings.cvText]);

  const uploadCv = async (input: HTMLInputElement): Promise<void> => {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!cvFileKind(file.name, file.type)) return notify(t.cvUnsupported, 'info');
    setReading(true);
    try {
      const text = await readCvFile(file);
      if (!text) return notify(t.cvUnreadable, 'warn');
      setCv(text);
      await update({ cvText: text, cvFileName: file.name });
      notify(fmt(t.cvLoaded, { name: file.name }));
    } catch (err) {
      console.warn('[Sanjob] CV file', err);
      notify(t.cvUnreadable, 'warn');
    } finally {
      setReading(false);
    }
  };

  const toggleAi = async (): Promise<void> => {
    if (!settings.aiEnabled) {
      // Asked once, right here: access to api.anthropic.com only.
      const granted = await chrome.permissions
        .request({ origins: [API_ORIGIN] })
        .catch(() => false);
      if (!granted) return notify(t.ai.needPermission, 'info');
    }
    await update({ aiEnabled: !settings.aiEnabled });
  };

  const storeKey = async (): Promise<void> => {
    const before = await loadApiKey();
    if (before === apiKey.trim()) return;
    await saveApiKey(apiKey);
    notify(apiKey.trim() ? t.ai.keySaved : t.ai.keyRemoved);
  };

  const clearHistory = async (): Promise<void> => {
    if (!confirm(t.confirmClearHistory)) return;
    await repo.clearHistory();
    setHistorySize(0);
    notify(t.historyCleared);
  };

  const num = (e: Event): number => Number((e.target as HTMLInputElement).value);

  return (
    <section class="card flex flex-col gap-4">
      <label class="flex flex-col gap-1">
        <span class="label">{t.language}</span>
        <select
          class="input"
          value={settings.language}
          onChange={(e) =>
            void update({ language: (e.target as HTMLSelectElement).value as Language })
          }
        >
          <option value="en">English</option>
          <option value="de">Deutsch</option>
        </select>
      </label>

      <fieldset class="flex flex-col gap-1">
        <legend class="label">{t.delay}</legend>
        <div class="flex items-center gap-2">
          <span class="text-xs">{t.delayMin}</span>
          <input
            type="number"
            min={1}
            max={120}
            class="input w-20"
            value={settings.delayMinSec}
            onChange={(e) => void update({ delayMinSec: num(e) })}
          />
          <span class="text-xs">{t.delayMax}</span>
          <input
            type="number"
            min={1}
            max={300}
            class="input w-20"
            value={settings.delayMaxSec}
            onChange={(e) => void update({ delayMaxSec: num(e) })}
          />
        </div>
      </fieldset>

      <label class="flex flex-col gap-1">
        <span class="label">{t.maxPages}</span>
        <input
          type="number"
          min={1}
          max={500}
          class="input w-24"
          value={settings.maxPages}
          onChange={(e) => void update({ maxPages: num(e) })}
        />
      </label>

      <label class="flex flex-col gap-1">
        <span class="label">{t.windowMode}</span>
        <select
          class="input"
          value={settings.windowMode}
          onChange={(e) => {
            const mode = (e.target as HTMLSelectElement).value as WindowMode;
            void update({ windowMode: mode }).then(() => send({ type: 'setWindowMode', mode }));
          }}
        >
          <option value="minimized">{t.windowMinimized}</option>
          <option value="normal">{t.windowNormal}</option>
        </select>
      </label>

      <div class="flex flex-col gap-1">
        <span class="label">{t.filter}</span>
        <select
          class="input"
          value={settings.filterPreset}
          onChange={(e) =>
            void update({
              filterPreset: (e.target as HTMLSelectElement).value as Settings['filterPreset'],
            })
          }
        >
          {FILTER_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name[settings.language]} – {p.keywords.join(', ')}
            </option>
          ))}
          <option value="custom">{t.filterCustom}</option>
          <option value="off">{t.filterOff}</option>
        </select>
        {settings.filterPreset === 'custom' && (
          <label class="mt-1 flex flex-col gap-1">
            <span class="text-xs text-slate-600 dark:text-slate-300">{t.filterWords}</span>
            <input
              class="input"
              value={words}
              onInput={(e) => setWords((e.target as HTMLInputElement).value)}
              onBlur={() =>
                void update({ excludeKeywords: parseKeywords(words) }).then(() => notify(t.saved))
              }
            />
          </label>
        )}
        <span class="text-[11px] text-slate-500 dark:text-slate-400">{t.filterHint}</span>
      </div>

      <label class="flex items-start gap-2">
        <input
          type="checkbox"
          class="mt-0.5"
          checked={settings.liveView}
          onChange={() => void update({ liveView: !settings.liveView })}
        />
        <span class="flex flex-col">
          <span class="label">{t.liveView}</span>
          <span class="text-xs text-slate-500 dark:text-slate-400">{t.liveViewHint}</span>
        </span>
      </label>

      <div class="flex flex-col gap-1">
        <span class="label">{t.cv}</span>
        <label class="btn w-fit cursor-pointer">
          {reading ? t.cvReading : t.cvUpload}
          <input
            type="file"
            class="hidden"
            accept=".pdf,.docx,.txt,.md,application/pdf,text/plain"
            disabled={reading}
            onChange={(e) => void uploadCv(e.target as HTMLInputElement)}
          />
        </label>
        {settings.cvFileName && settings.cvText === cv && (
          <span class="text-[11px] text-slate-500 dark:text-slate-400">
            📄 {settings.cvFileName}
          </span>
        )}
        <textarea
          class="input min-h-40 font-mono text-xs"
          aria-label={t.cv}
          placeholder={t.cvPlaceholder}
          value={cv}
          onInput={(e) => setCv((e.target as HTMLTextAreaElement).value)}
          onBlur={() =>
            cv !== settings.cvText &&
            void update({ cvText: cv, cvFileName: '' }).then(() => notify(t.saved))
          }
        />
      </div>

      <div class="flex flex-col gap-2 rounded-lg border border-slate-200 p-2 dark:border-slate-700">
        <span class="label">{t.ai.title}</span>
        <label class="flex items-start gap-2">
          <input
            type="checkbox"
            class="mt-0.5"
            checked={settings.aiEnabled}
            onChange={() => void toggleAi()}
          />
          <span class="text-sm">{t.ai.enable}</span>
        </label>
        <span class="text-[11px] text-slate-500 dark:text-slate-400">{t.ai.hint}</span>
        {settings.aiEnabled && (
          <>
            <label class="flex flex-col gap-1">
              <span class="text-xs text-slate-600 dark:text-slate-300">{t.ai.key}</span>
              <input
                type="password"
                class="input font-mono"
                autocomplete="off"
                spellcheck={false}
                placeholder={t.ai.keyPlaceholder}
                value={apiKey}
                onInput={(e) => setApiKey((e.target as HTMLInputElement).value)}
                onBlur={() => void storeKey()}
              />
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-xs text-slate-600 dark:text-slate-300">{t.ai.model}</span>
              <select
                class="input"
                value={settings.aiModel}
                onChange={(e) =>
                  void update({ aiModel: (e.target as HTMLSelectElement).value as AiModel })
                }
              >
                {AI_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
      </div>

      <div class="flex flex-col gap-1">
        <span class="label">{t.history}</span>
        <div class="flex items-center gap-2">
          <span class="flex-1 text-xs">{fmt(t.historyCount, { n: historySize })}</span>
          <button class="btn btn-danger" onClick={() => void clearHistory()}>
            {t.clearHistory}
          </button>
        </div>
      </div>

      <p class="text-xs text-slate-500 dark:text-slate-400">{t.privacy}</p>
    </section>
  );
}
