import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { repo } from '../db/db';
import { STRINGS } from '../shared/i18n';
import { HOVER_PORT, type Broadcast } from '../shared/messages';
import { loadSettings, saveSettings } from '../shared/settings';
import type { JobRecord, RunState, Settings } from '../shared/types';
import { send, subscribe } from './api';
import { AnalysisCard } from './components/AnalysisCard';
import { JobTable } from './components/JobTable';
import { Logo } from './components/Logo';
import { ProgressCard } from './components/ProgressPanel';
import { SettingsView } from './components/SettingsView';
import { SummaryCard } from './components/SummaryCard';

export type ToastKind = 'success' | 'info' | 'warn';
interface Toast {
  id: number;
  text: string;
  kind: ToastKind;
}
export type Notify = (text: string, kind?: ToastKind) => void;

const ACTIVE = new Set<RunState['status']>([
  'running',
  'paused',
  'blocked',
  'interrupted',
  'error',
]);

export function App() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [view, setView] = useState<'main' | 'settings'>('main');
  const [run, setRun] = useState<RunState | null>(null);
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [lastRunId, setLastRunId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dismissedRun, setDismissedRun] = useState<string | null>(null);
  const [picker, setPicker] = useState<Extract<Broadcast, { type: 'pickerResult' }> | null>(null);
  const tableRef = useRef<HTMLElement>(null);
  const toastId = useRef(0);

  const reloadJobs = useCallback(async () => {
    setJobs(await repo.allJobs());
    setLastRunId(await repo.getLastRunId());
  }, []);

  const notify: Notify = useCallback((text, kind = 'success') => {
    const id = ++toastId.current;
    setToasts((list) => [...list.slice(-2), { id, text, kind }]);
    setTimeout(() => setToasts((list) => list.filter((x) => x.id !== id)), 3800);
  }, []);

  useEffect(() => {
    void loadSettings().then(setSettings);
    void send({ type: 'getState' }).then((r) => setRun(r.state ?? null));
    void reloadJobs();
    // Live updates from the service worker (the panel is only a view of the stored state).
    const unsubscribe = subscribe((msg) => {
      if (msg.type === 'state') setRun(msg.state);
      if (msg.type === 'jobsChanged') void reloadJobs();
    });
    const onMessage = (msg: Broadcast): void => {
      if (msg.type === 'pickerResult') setPicker(msg);
    };
    chrome.runtime.onMessage.addListener(onMessage);
    // The page's hover preview stays on while this panel is open (it ends when the port closes).
    const hoverPorts = new Set<chrome.runtime.Port>();
    const onConnect = (port: chrome.runtime.Port): void => {
      if (port.name !== HOVER_PORT) return;
      hoverPorts.add(port);
      port.onDisconnect.addListener(() => hoverPorts.delete(port));
    };
    chrome.runtime.onConnect.addListener(onConnect);
    const onStorage = (changes: Record<string, chrome.storage.StorageChange>): void => {
      if (changes['settings']) void loadSettings().then(setSettings);
    };
    chrome.storage.onChanged.addListener(onStorage);
    return () => {
      unsubscribe();
      chrome.runtime.onMessage.removeListener(onMessage);
      chrome.runtime.onConnect.removeListener(onConnect);
      hoverPorts.forEach((p) => p.disconnect());
      chrome.storage.onChanged.removeListener(onStorage);
    };
  }, [reloadJobs]);

  // A finished run reloads the table once more (last job included).
  useEffect(() => {
    if (run?.status === 'done') void reloadJobs();
  }, [run?.status, reloadJobs]);

  useEffect(() => {
    if (settings) document.documentElement.lang = settings.language;
  }, [settings?.language]);

  if (!settings) return null;
  const t = STRINGS[settings.language];
  const update = async (patch: Partial<Settings>): Promise<void> =>
    setSettings(await saveSettings(patch));
  const openTable = (): void => tableRef.current?.scrollIntoView({ behavior: 'smooth' });

  const active = run !== null && ACTIVE.has(run.status);
  const showSummary = run?.status === 'done' && dismissedRun !== run.runId;

  return (
    <div class="mx-auto flex max-w-5xl flex-col gap-3 p-3 text-sm">
      <header class="flex items-center gap-2">
        <Logo class="h-8 w-8" />
        <div class="flex-1">
          <h1 class="text-base leading-tight font-semibold">Sanjob</h1>
          <p class="text-xs text-slate-500 dark:text-slate-400">{t.appTagline}</p>
        </div>
        <button class="btn" onClick={() => setView(view === 'main' ? 'settings' : 'main')}>
          {view === 'main' ? t.settings : t.back}
        </button>
      </header>

      {view === 'settings' ? (
        <SettingsView t={t} settings={settings} update={update} notify={notify} />
      ) : (
        <>
          {active && run ? (
            <ProgressCard t={t} run={run} settings={settings} notify={notify} />
          ) : showSummary && run ? (
            <SummaryCard
              t={t}
              run={run}
              jobs={jobs}
              lastRunId={lastRunId}
              settings={settings}
              notify={notify}
              onOpenTable={openTable}
              onClose={() => setDismissedRun(run.runId)}
            />
          ) : (
            <AnalysisCard
              t={t}
              settings={settings}
              update={update}
              picker={picker}
              clearPicker={() => setPicker(null)}
              notify={notify}
              onStarted={setRun}
            />
          )}
          <JobTable
            t={t}
            settings={settings}
            update={update}
            jobs={jobs}
            lastRunId={lastRunId}
            reload={reloadJobs}
            notify={notify}
            sectionRef={tableRef}
          />
        </>
      )}

      <div class="pointer-events-none fixed right-3 bottom-3 left-3 flex flex-col items-center gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            class={`animate-in pointer-events-auto rounded-xl px-4 py-2 text-center shadow-lg ${
              toast.kind === 'warn'
                ? 'bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-50'
                : toast.kind === 'info'
                  ? 'bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'bg-emerald-600 text-white'
            }`}
          >
            {toast.text}
          </div>
        ))}
      </div>
    </div>
  );
}
