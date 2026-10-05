import { useEffect, useState } from 'preact/hooks';
import { presetForUrl } from '../../presets/presets';
import { fmt, type Strings } from '../../shared/i18n';
import type { Broadcast } from '../../shared/messages';
import { loadGenericConfig, saveGenericConfig } from '../../shared/settings';
import type { GenericConfig, RunState, Settings } from '../../shared/types';
import { activeTab, ensureOriginAccess, runInActiveTab, send } from '../api';

interface Props {
  t: Strings;
  settings: Settings;
  lastRun: RunState | null;
  picker: Extract<Broadcast, { type: 'pickerResult' }> | null;
  clearPicker: () => void;
  notify: (msg: string) => void;
  onStarted: (state: RunState | null) => void;
}

export function CollectPanel({
  t,
  settings,
  lastRun,
  picker,
  clearPicker,
  notify,
  onStarted,
}: Props) {
  const [tab, setTab] = useState<chrome.tabs.Tab | null>(null);
  const [maxPages, setMaxPages] = useState(settings.maxPages);
  const [generic, setGeneric] = useState<GenericConfig | null>(null);
  const [cardInfo, setCardInfo] = useState('');
  const [busy, setBusy] = useState(false);

  const url = tab?.url ?? '';
  const isWeb = /^https?:\/\//.test(url);
  const preset = isWeb ? presetForUrl(url) : null;
  const origin = isWeb ? new URL(url).origin : '';

  useEffect(() => {
    const refresh = (): void => void activeTab().then(setTab);
    refresh();
    chrome.tabs.onActivated.addListener(refresh);
    const onUpdated = (_id: number, info: { url?: string; status?: string }): void => {
      if (info.url || info.status === 'complete') refresh();
    };
    chrome.tabs.onUpdated.addListener(onUpdated);
    return () => {
      chrome.tabs.onActivated.removeListener(refresh);
      chrome.tabs.onUpdated.removeListener(onUpdated);
    };
  }, []);

  useEffect(() => setMaxPages(settings.maxPages), [settings.maxPages]);

  useEffect(() => {
    setCardInfo('');
    if (origin && !preset) void loadGenericConfig(origin).then(setGeneric);
    else setGeneric(null);
  }, [origin, preset?.id]);

  // Result of the point-and-click picker (sent by the content script).
  useEffect(() => {
    if (!picker || picker.origin !== origin) return;
    clearPicker();
    if (picker.cancelled) return;
    if (picker.selector) {
      const cfg = { cardSelector: picker.selector };
      void saveGenericConfig(origin, cfg).then(() => setGeneric(cfg));
      setCardInfo(fmt(t.cardsFound, { n: picker.count }));
    } else {
      setCardInfo(t.noCardsFound);
    }
  }, [picker, origin]);

  const withAccess = async (fn: (tabId: number) => Promise<void>): Promise<void> => {
    if (!tab?.id || !isWeb) return;
    if (!preset && !(await ensureOriginAccess(url))) {
      notify(t.permissionDenied);
      return;
    }
    setBusy(true);
    try {
      await fn(tab.id);
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const autoDetect = (): Promise<void> =>
    withAccess(async (tabId) => {
      const res = await runInActiveTab(tabId, { type: 'detectCards' });
      if (res?.type === 'detectCards' && res.selector) {
        const cfg = { cardSelector: res.selector };
        await saveGenericConfig(origin, cfg);
        setGeneric(cfg);
        setCardInfo(fmt(t.cardsFound, { n: res.count }));
      } else {
        setCardInfo(t.noCardsFound);
      }
    });

  const pick = (): Promise<void> =>
    withAccess(async (tabId) => {
      setCardInfo(t.pickerHint);
      await runInActiveTab(tabId, { type: 'startPicker', lang: settings.language });
    });

  const start = (): Promise<void> =>
    withAccess(async () => {
      const res = await send({ type: 'start', url, maxPages, generic: generic ?? undefined });
      if (!res.ok) notify(res.error ?? 'Error');
      else onStarted(res.state ?? null);
    });

  return (
    <section class="card flex flex-col gap-3">
      <h2 class="font-semibold">{t.collect}</h2>
      {lastRun?.status === 'done' && (
        <p class="text-xs text-emerald-700 dark:text-emerald-400">
          {t.status.done}: {lastRun.done} {t.jobsProgress}
        </p>
      )}
      <div>
        <div class="label">{t.currentPage}</div>
        <div class="truncate text-xs text-slate-500 dark:text-slate-400" title={url}>
          {url || '—'}
        </div>
        {isWeb && (
          <div class="mt-1 text-xs">
            {t.site}: <strong>{preset ? preset.name : t.genericSite}</strong>
          </div>
        )}
      </div>

      {!isWeb && <p class="text-xs text-amber-700 dark:text-amber-400">{t.unsupportedPage}</p>}

      {isWeb && !preset && (
        <div class="flex flex-col gap-2 rounded-lg bg-slate-50 p-2 dark:bg-slate-900">
          <p class="text-xs text-slate-500 dark:text-slate-400">{t.genericNeedsAccess}</p>
          <div class="flex flex-wrap gap-2">
            <button class="btn" disabled={busy} onClick={autoDetect}>
              {t.autoDetect}
            </button>
            <button class="btn" disabled={busy} onClick={pick}>
              {t.pickCard}
            </button>
          </div>
          {generic && (
            <code class="block truncate text-[11px] text-slate-500" title={generic.cardSelector}>
              {generic.cardSelector}
            </code>
          )}
          {cardInfo && <p class="text-xs">{cardInfo}</p>}
        </div>
      )}

      <div class="flex items-end gap-2">
        <label class="flex flex-col gap-1">
          <span class="label">{t.maxPages}</span>
          <input
            type="number"
            min={1}
            max={500}
            class="input w-24"
            value={maxPages}
            onInput={(e) =>
              setMaxPages(Math.max(1, Number((e.target as HTMLInputElement).value) || 1))
            }
          />
        </label>
        <button class="btn btn-primary flex-1" disabled={!isWeb || busy} onClick={start}>
          {t.start}
        </button>
      </div>
    </section>
  );
}
