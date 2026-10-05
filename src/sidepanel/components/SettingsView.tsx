import { useEffect, useState } from 'preact/hooks';
import { repo } from '../../db/db';
import { FILTER_PRESETS, parseKeywords } from '../../shared/filter';
import { fmt, type Strings } from '../../shared/i18n';
import type { Language, Settings, WindowMode } from '../../shared/types';
import { send } from '../api';

interface Props {
  t: Strings;
  settings: Settings;
  update: (patch: Partial<Settings>) => Promise<void>;
  notify: (msg: string) => void;
}

export function SettingsView({ t, settings, update, notify }: Props) {
  const [historySize, setHistorySize] = useState(0);
  const [cv, setCv] = useState(settings.cvText);
  const [words, setWords] = useState(settings.excludeKeywords.join(', '));

  useEffect(() => {
    void repo.historySize().then(setHistorySize);
  }, []);

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

      <label class="flex flex-col gap-1">
        <span class="label">{t.cv}</span>
        <textarea
          class="input min-h-40 font-mono text-xs"
          placeholder={t.cvPlaceholder}
          value={cv}
          onInput={(e) => setCv((e.target as HTMLTextAreaElement).value)}
          onBlur={() => void update({ cvText: cv }).then(() => notify(t.saved))}
        />
      </label>

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
