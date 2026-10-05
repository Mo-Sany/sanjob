import { useEffect, useState } from 'preact/hooks';
import { fmt, formatDuration, formatNumber, type Strings } from '../../shared/i18n';
import type { RunState, Settings } from '../../shared/types';
import { send } from '../api';
import type { Notify } from '../App';

interface Props {
  t: Strings;
  run: RunState;
  settings: Settings;
  notify: Notify;
}

/** How long a notice ("trying again…") stays visible. */
const NOTICE_MS = 12000;

const DOT: Record<RunState['status'], string> = {
  idle: 'bg-slate-400',
  running: 'bg-teal-500 animate-pulse',
  paused: 'bg-amber-500',
  blocked: 'bg-rose-500 animate-pulse',
  interrupted: 'bg-amber-500',
  done: 'bg-emerald-500',
  error: 'bg-amber-500',
};

export function ProgressCard({ t, run, settings, notify }: Props) {
  const [now, setNow] = useState(Date.now());
  const [showDetails, setShowDetails] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const act = async (type: 'pause' | 'resume' | 'cancel' | 'finish'): Promise<void> => {
    if (type === 'cancel' && !confirm(t.confirmStop)) return;
    const res = await send({ type });
    if (!res.ok) notify(t.problems[res.code ?? 'unknown'], 'warn');
  };

  const n = (x: number): string => formatNumber(x, settings.language);
  const processed = run.done + run.errors;
  const percent = run.total ? Math.min(100, Math.round((processed / run.total) * 100)) : 0;
  const canContinue = ['paused', 'blocked', 'interrupted', 'error'].includes(run.status);
  const showNotice = run.notice && (now - run.notice.at < NOTICE_MS || run.status !== 'running');

  const avgSec = (settings.delayMinSec + settings.delayMaxSec) / 2 + 3;
  const perItemMs = run.avgItemMs || avgSec * 1000;
  const remainingMs = Math.max(0, run.total - processed) * perItemMs;

  return (
    <section class="card animate-in flex flex-col gap-3" aria-live="polite">
      <div class="flex items-center gap-2">
        <span class={`h-2.5 w-2.5 rounded-full ${DOT[run.status]}`} />
        <span class="font-semibold">{t.status[run.status]}</span>
        <span class="truncate text-xs text-slate-500 dark:text-slate-400">· {run.siteName}</span>
      </div>

      {run.status === 'interrupted' && (
        <p class="rounded-lg bg-amber-50 p-2 text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          {t.interruptedNotice}
        </p>
      )}

      {run.status === 'blocked' && run.block && (
        <div class="animate-in rounded-lg border-2 border-amber-400 bg-amber-50 p-3 text-amber-950 dark:bg-amber-950 dark:text-amber-100">
          <p class="font-medium">{fmt(t.blocked[run.block.kind], { site: run.siteName })}</p>
        </div>
      )}

      {showNotice && run.notice && run.status !== 'blocked' && (
        <p class="animate-in rounded-lg bg-sky-50 p-2 text-xs text-sky-900 dark:bg-sky-950 dark:text-sky-100">
          {t.notices[run.notice.key]}
        </p>
      )}

      {run.suggestWindowMode && (
        <div class="rounded-lg bg-sky-50 p-2 text-xs text-sky-900 dark:bg-sky-950 dark:text-sky-100">
          <p>{t.windowHint}</p>
          <div class="mt-2 flex gap-2">
            <button
              class="btn"
              onClick={() => void send({ type: 'setWindowMode', mode: 'normal' })}
            >
              {t.switchWindow}
            </button>
            <button
              class="btn"
              onClick={() => void send({ type: 'setWindowMode', mode: 'minimized' })}
            >
              {t.dismiss}
            </button>
          </div>
        </div>
      )}

      <div>
        <div class="mb-1 flex justify-between text-xs text-slate-600 dark:text-slate-300">
          <span>
            {run.phase === 'details'
              ? fmt(t.readingJobs, {
                  n: n(Math.min(processed + 1, run.total)),
                  total: n(run.total),
                })
              : fmt(t.findingJobs, { n: run.pagesDone + 1 })}
          </span>
          {run.phase === 'details' && run.total > 0 && run.status === 'running' && (
            <span>
              {fmt(t.timeLeft, { t: formatDuration(remainingMs / 1000, settings.language) })}
            </span>
          )}
        </div>
        <div class="h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
          {run.phase === 'details' ? (
            <div
              class="h-full rounded-full bg-teal-600 transition-all duration-500"
              style={{ width: `${percent}%` }}
            />
          ) : (
            <div class="progress-indeterminate h-full w-full rounded-full bg-teal-500" />
          )}
        </div>
      </div>

      {run.waiting && run.status === 'running' && (
        <p class="animate-in rounded-lg bg-emerald-50 p-2 text-xs text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
          ⬇ {t.waitingNew}
        </p>
      )}

      {run.currentTitle && run.status === 'running' && (
        <p class="truncate text-xs" title={run.currentTitle}>
          <span class="text-slate-500 dark:text-slate-400">{t.reading}: </span>
          <span class="font-medium">{run.currentTitle}</span>
        </p>
      )}

      <div class="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
        <Stat
          label={t.collected}
          value={n(run.done)}
          tone="text-emerald-700 dark:text-emerald-400"
        />
        <Stat
          label={t.skippedSaved}
          value={n(run.skipped)}
          tone="text-slate-700 dark:text-slate-200"
        />
        <Stat
          label={t.filteredOut}
          value={n(run.filtered ?? 0)}
          tone="text-slate-700 dark:text-slate-200"
        />
        <Stat
          label={t.unreadable}
          value={n(run.errors)}
          tone="text-amber-700 dark:text-amber-400"
        />
      </div>

      <div class="flex gap-2">
        {run.status === 'running' && (
          <button class="btn flex-1" onClick={() => void act('pause')}>
            ⏸ {t.pause}
          </button>
        )}
        {canContinue && (
          <button class="btn btn-primary flex-1" onClick={() => void act('resume')}>
            ▶ {t.continue}
          </button>
        )}
        {run.mode === 'continuous' && (
          <button class="btn" onClick={() => void act('finish')}>
            ✓ {t.finish}
          </button>
        )}
        <button class="btn btn-danger" onClick={() => void act('cancel')}>
          ■ {t.stop}
        </button>
      </div>

      {run.status === 'running' && (
        <p class="text-[11px] text-slate-500 dark:text-slate-400">{t.keepRunning}</p>
      )}

      {(run.lastError || run.current) && (
        <div class="text-[11px]">
          <button
            class="text-slate-500 underline-offset-2 hover:underline dark:text-slate-400"
            onClick={() => setShowDetails(!showDetails)}
          >
            {showDetails ? t.hideDetails : t.details}
          </button>
          {showDetails && (
            <pre class="mt-1 max-h-32 overflow-auto rounded bg-slate-100 p-2 font-mono break-all whitespace-pre-wrap text-slate-600 dark:bg-slate-900 dark:text-slate-300">
              {[run.current, run.lastError].filter(Boolean).join('\n')}
            </pre>
          )}
        </div>
      )}
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div class="rounded-lg bg-slate-50 p-2 dark:bg-slate-900">
      <div class={`text-lg font-semibold tabular-nums ${tone}`}>{value}</div>
      <div class="text-[11px] text-slate-500 dark:text-slate-400">{label}</div>
    </div>
  );
}
