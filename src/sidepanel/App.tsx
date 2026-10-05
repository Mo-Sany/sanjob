import { useCallback, useEffect, useState } from 'preact/hooks';
import { repo } from '../db/db';
import { STRINGS } from '../shared/i18n';
import type { Broadcast } from '../shared/messages';
import { loadSettings, saveSettings } from '../shared/settings';
import type { JobRecord, RunState, Settings } from '../shared/types';
import { send } from './api';
import { CollectPanel } from './components/CollectPanel';
import { JobTable } from './components/JobTable';
import { Logo } from './components/Logo';
import { ProgressPanel } from './components/ProgressPanel';
import { SettingsView } from './components/SettingsView';

export function App() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [view, setView] = useState<'main' | 'settings'>('main');
  const [run, setRun] = useState<RunState | null>(null);
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [lastRunId, setLastRunId] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [picker, setPicker] = useState<Extract<Broadcast, { type: 'pickerResult' }> | null>(null);

  const reloadJobs = useCallback(async () => {
    setJobs(await repo.allJobs());
    setLastRunId(await repo.getLastRunId());
  }, []);

  useEffect(() => {
    void loadSettings().then(setSettings);
    void send({ type: 'getState' }).then((r) => setRun(r.state ?? null));
    void reloadJobs();
    const onMessage = (msg: Broadcast): void => {
      if (msg.type === 'state') setRun(msg.state);
      if (msg.type === 'jobsChanged') void reloadJobs();
      if (msg.type === 'pickerResult') setPicker(msg);
    };
    chrome.runtime.onMessage.addListener(onMessage);
    return () => chrome.runtime.onMessage.removeListener(onMessage);
  }, [reloadJobs]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    if (settings) document.documentElement.lang = settings.language;
  }, [settings]);

  if (!settings) return null;
  const t = STRINGS[settings.language];
  const update = async (patch: Partial<Settings>): Promise<void> =>
    setSettings(await saveSettings(patch));

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
        <SettingsView t={t} settings={settings} update={update} notify={setToast} />
      ) : (
        <>
          {run && run.status !== 'done' ? (
            <ProgressPanel t={t} run={run} notify={setToast} />
          ) : (
            <CollectPanel
              t={t}
              settings={settings}
              lastRun={run}
              picker={picker}
              clearPicker={() => setPicker(null)}
              notify={setToast}
              onStarted={setRun}
            />
          )}
          <JobTable
            t={t}
            settings={settings}
            jobs={jobs}
            lastRunId={lastRunId}
            reload={reloadJobs}
            notify={setToast}
          />
        </>
      )}

      {toast && (
        <div
          role="status"
          class="fixed right-3 bottom-3 left-3 rounded-lg bg-slate-900 px-3 py-2 text-center text-white shadow-lg dark:bg-slate-100 dark:text-slate-900"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
