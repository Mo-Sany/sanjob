import { useEffect, useRef, useState } from 'preact/hooks';
import { repo } from '../../db/db';
import { estimateSeconds } from '../../extract/analyze';
import { presetForUrl } from '../../presets/presets';
import { fmt, formatDuration, formatNumber, type Strings } from '../../shared/i18n';
import type { Broadcast } from '../../shared/messages';
import { loadGenericConfig, saveGenericConfig } from '../../shared/settings';
import type { GenericConfig, PageAnalysis, RunState, Settings } from '../../shared/types';
import { normalizeUrl } from '../../shared/url';
import { activeTab, ensureOriginAccess, originPattern, runInActiveTab, send } from '../api';
import type { Notify } from '../App';

interface Props {
  t: Strings;
  settings: Settings;
  picker: Extract<Broadcast, { type: 'pickerResult' }> | null;
  clearPicker: () => void;
  notify: Notify;
  onStarted: (state: RunState | null) => void;
}

type View =
  | { kind: 'loading' }
  | { kind: 'notWeb' }
  | { kind: 'needAccess'; host: string }
  | { kind: 'denied' }
  | { kind: 'ready'; analysis: PageAnalysis; known: number };

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * Reads the active page as soon as the panel opens or the tab changes and shows what
 * Sanjob found there, before anything is started.
 */
export function AnalysisCard({ t, settings, picker, clearPicker, notify, onStarted }: Props) {
  const [tab, setTab] = useState<chrome.tabs.Tab | null>(null);
  const [view, setView] = useState<View>({ kind: 'loading' });
  const [pages, setPages] = useState(settings.maxPages);
  const [generic, setGeneric] = useState<GenericConfig | null>(null);
  const [hint, setHint] = useState('');
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);

  const url = tab?.url ?? '';
  const isWeb = /^https?:\/\//.test(url);
  const preset = isWeb ? presetForUrl(url) : null;
  const origin = isWeb ? new URL(url).origin : '';

  const analyze = async (
    target: chrome.tabs.Tab | null,
    cfg: GenericConfig | null,
  ): Promise<void> => {
    const my = ++seq.current;
    const targetUrl = target?.url ?? '';
    if (!target?.id || !/^https?:\/\//.test(targetUrl)) {
      setView({ kind: 'notWeb' });
      return;
    }
    const pattern = originPattern(targetUrl);
    const hasAccess =
      presetForUrl(targetUrl) !== null ||
      (pattern !== null && (await chrome.permissions.contains({ origins: [pattern] })));
    if (!hasAccess) {
      setView({ kind: 'needAccess', host: hostOf(targetUrl) });
      return;
    }
    setView({ kind: 'loading' });
    try {
      const res = await runInActiveTab(target.id, { type: 'analyze', generic: cfg ?? undefined });
      if (my !== seq.current) return;
      if (res?.type !== 'analyze') throw new Error('no analysis');
      const keys = res.result.links.map((l) => normalizeUrl(l));
      let known = 0;
      for (const key of keys) if (await repo.isKnown(key)) known++;
      if (my !== seq.current) return;
      setView({ kind: 'ready', analysis: res.result, known });
      setPages(Math.max(1, Math.min(500, res.result.totalPages ?? settings.maxPages)));
    } catch (err) {
      console.info('[Sanjob] page not readable', err);
      if (my === seq.current) setView({ kind: 'notWeb' });
    }
  };

  // Follow the active tab of this window.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = (): void => {
      clearTimeout(timer);
      timer = setTimeout(() => void activeTab().then(setTab), 250);
    };
    refresh();
    const onUpdated = (
      _id: number,
      info: { url?: string; status?: string },
      changed: chrome.tabs.Tab,
    ): void => {
      if (changed.active && (info.url || info.status === 'complete')) refresh();
    };
    chrome.tabs.onActivated.addListener(refresh);
    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.windows.onFocusChanged.addListener(refresh);
    return () => {
      clearTimeout(timer);
      chrome.tabs.onActivated.removeListener(refresh);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      chrome.windows.onFocusChanged.removeListener(refresh);
    };
  }, []);

  // Load the manually chosen list for this site (if any), then analyze.
  useEffect(() => {
    setHint('');
    if (!origin) {
      setGeneric(null);
      void analyze(tab, null);
      return;
    }
    void loadGenericConfig(origin).then((cfg) => {
      setGeneric(cfg);
      void analyze(tab, cfg);
    });
  }, [tab?.id, url]);

  // Result of the point-and-click picker.
  useEffect(() => {
    if (!picker || picker.origin !== origin) return;
    clearPicker();
    if (picker.cancelled) {
      setHint('');
      return;
    }
    if (picker.selector) {
      const cfg = { cardSelector: picker.selector };
      void saveGenericConfig(origin, cfg).then(() => {
        setGeneric(cfg);
        setHint(fmt(t.pickerPicked, { n: picker.count }));
        void analyze(tab, cfg);
      });
    } else {
      setHint(t.pickerNothing);
    }
  }, [picker]);

  const withAccess = async (fn: (tabId: number) => Promise<void>): Promise<boolean> => {
    if (!tab?.id || !isWeb) return false;
    if (!preset && !(await ensureOriginAccess(url))) {
      setView({ kind: 'denied' });
      return false;
    }
    setBusy(true);
    try {
      await fn(tab.id);
      return true;
    } catch (err) {
      console.warn('[Sanjob]', err);
      notify(t.problems.unknown, 'warn');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const allowAndAnalyze = (): Promise<boolean> => withAccess(async () => analyze(tab, generic));

  const pickManually = (): Promise<boolean> =>
    withAccess(async (tabId) => {
      setHint(t.pickerHint);
      await runInActiveTab(tabId, { type: 'startPicker', lang: settings.language });
    });

  const resetList = async (): Promise<void> => {
    await saveGenericConfig(origin, null);
    setGeneric(null);
    setHint('');
    void analyze(tab, null);
  };

  const start = (maxPages: number): Promise<boolean> =>
    withAccess(async () => {
      const siteName = view.kind === 'ready' ? view.analysis.siteName : hostOf(url);
      const res = await send({
        type: 'start',
        url,
        maxPages,
        generic: generic ?? undefined,
        siteName,
        sourceTabId: tab?.id,
      });
      if (!res.ok) notify(t.problems[res.code ?? 'unknown'], 'warn');
      else onStarted(res.state ?? null);
    });

  const n = (x: number): string => formatNumber(x, settings.language);

  if (view.kind === 'loading') {
    return (
      <section class="card flex items-center gap-3">
        <span class="h-4 w-4 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
        <span class="text-slate-600 dark:text-slate-300">{t.analyzing}</span>
      </section>
    );
  }

  if (view.kind === 'notWeb') {
    return (
      <section class="card animate-in flex flex-col gap-2">
        <p class="text-2xl">🔎</p>
        <p class="text-slate-700 dark:text-slate-200">{t.notWeb}</p>
      </section>
    );
  }

  if (view.kind === 'needAccess' || view.kind === 'denied') {
    return (
      <section class="card animate-in flex flex-col gap-3">
        <p class="text-slate-700 dark:text-slate-200">
          {view.kind === 'denied' ? t.accessDenied : fmt(t.needAccess, { site: view.host })}
        </p>
        <button
          class="btn btn-primary self-start"
          disabled={busy}
          onClick={() => void allowAndAnalyze()}
        >
          {t.allowAccess}
        </button>
      </section>
    );
  }

  const { analysis, known } = view;
  const manualButton = (
    <button class="btn" disabled={busy} onClick={() => void pickManually()}>
      🎯 {t.chooseManually}
    </button>
  );

  if (!analysis.isJobList) {
    return (
      <section class="card animate-in flex flex-col gap-3">
        <p class="text-2xl">🧭</p>
        <p class="text-slate-700 dark:text-slate-200">{t.notJobList}</p>
        {hint && <p class="text-xs text-teal-700 dark:text-teal-300">{hint}</p>}
        <div class="flex flex-wrap gap-2">
          {manualButton}
          <button class="btn" onClick={() => void analyze(tab, generic)}>
            ↻ {t.reload}
          </button>
        </div>
      </section>
    );
  }

  const avgDelay = (settings.delayMinSec + settings.delayMaxSec) / 2;
  const plannedJobs = analysis.totalResults
    ? Math.min(analysis.totalResults, analysis.itemsOnPage * pages)
    : analysis.itemsOnPage * pages;
  const newJobs = Math.max(0, plannedJobs - known);
  const seconds = estimateSeconds(pages, newJobs, avgDelay);

  return (
    <section class="card animate-in flex flex-col gap-3">
      <div class="flex items-center gap-2">
        <span class="h-2.5 w-2.5 rounded-full bg-emerald-500" />
        <h2 class="flex-1 text-base font-semibold">
          {analysis.site === 'generic'
            ? t.otherSite
            : fmt(t.siteDetected, { site: analysis.siteName })}
        </h2>
        {analysis.confident && (
          <span class="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100">
            {t.smartDetection}
          </span>
        )}
      </div>

      <p class="text-slate-700 dark:text-slate-200">
        {[
          fmt(t.jobsOnPage, { n: n(analysis.itemsOnPage) }),
          analysis.totalResults ? fmt(t.totalJobs, { n: n(analysis.totalResults) }) : null,
          analysis.totalPages
            ? analysis.totalPages === 1
              ? t.onePage
              : fmt(t.pagesCount, { n: n(analysis.totalPages) })
            : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>
      <p class="text-xs text-slate-500 dark:text-slate-400">
        ⏱ {fmt(t.estimate, { t: formatDuration(seconds, settings.language) })}
      </p>
      {known > 0 && (
        <p class="text-xs text-slate-500 dark:text-slate-400">
          ✓ {fmt(t.alreadyCollected, { n: n(known) })}
        </p>
      )}
      {generic && (
        <p class="text-xs text-slate-500 dark:text-slate-400">
          🎯 {t.manualList} ·{' '}
          <button
            class="text-teal-700 hover:underline dark:text-teal-300"
            onClick={() => void resetList()}
          >
            {t.resetList}
          </button>
        </p>
      )}
      {hint && <p class="text-xs text-teal-700 dark:text-teal-300">{hint}</p>}

      <label class="flex items-center gap-2 text-xs">
        <span class="label">{t.pagesToCollect}</span>
        <input
          type="number"
          min={1}
          max={500}
          class="input w-20"
          value={pages}
          onInput={(e) =>
            setPages(Math.max(1, Math.min(500, Number((e.target as HTMLInputElement).value) || 1)))
          }
        />
      </label>

      <div class="flex flex-wrap gap-2">
        <button class="btn btn-primary flex-1" disabled={busy} onClick={() => void start(pages)}>
          ▶ {t.startCollecting}
        </button>
        <button class="btn" disabled={busy} onClick={() => void start(1)}>
          {t.onlyThisPage}
        </button>
        {manualButton}
      </div>
    </section>
  );
}
