import type { Strings } from '../../shared/i18n';
import type { RunState } from '../../shared/types';
import { send } from '../api';

interface Props {
  t: Strings;
  run: RunState;
  notify: (msg: string) => void;
}

const STATUS_COLORS: Record<RunState['status'], string> = {
  idle: 'bg-slate-200 text-slate-800',
  running: 'bg-teal-100 text-teal-800',
  paused: 'bg-amber-100 text-amber-800',
  blocked: 'bg-rose-100 text-rose-800',
  interrupted: 'bg-amber-100 text-amber-800',
  done: 'bg-emerald-100 text-emerald-800',
  error: 'bg-rose-100 text-rose-800',
};

export function ProgressPanel({ t, run, notify }: Props) {
  const act = async (type: 'pause' | 'resume' | 'cancel'): Promise<void> => {
    if (type === 'cancel' && !confirm(t.confirmCancel)) return;
    const res = await send({ type });
    if (!res.ok) notify(res.error ?? 'Error');
  };
  const percent = run.total ? Math.round(((run.done + run.errors) / run.total) * 100) : 0;
  const canResume = ['paused', 'blocked', 'interrupted', 'error'].includes(run.status);

  return (
    <section class="card flex flex-col gap-3" aria-live="polite">
      <div class="flex items-center gap-2">
        <span class={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[run.status]}`}>
          {t.status[run.status]}
        </span>
        <span class="text-xs text-slate-500 dark:text-slate-400">{t.phase[run.phase]}</span>
      </div>

      {run.status === 'interrupted' && (
        <p class="rounded-lg bg-amber-50 p-2 text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          {t.interruptedNotice}
        </p>
      )}

      {run.status === 'blocked' && run.block && (
        <div class="rounded-lg border-2 border-rose-400 bg-rose-50 p-3 text-rose-900 dark:bg-rose-950 dark:text-rose-100">
          <p class="font-semibold">{t.blocked[run.block.kind]}</p>
          <p class="mt-1 text-xs">{t.blockedHelp}</p>
          <p class="mt-1 text-[11px] opacity-70">{run.block.reason}</p>
        </div>
      )}

      {run.status === 'error' && run.lastError && (
        <p class="rounded-lg bg-rose-50 p-2 text-xs text-rose-900 dark:bg-rose-950 dark:text-rose-200">
          {run.lastError}
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

      <dl class="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <dt class="text-slate-500 dark:text-slate-400">{t.pages}</dt>
        <dd>
          {run.pagesDone} / {run.maxPages}
        </dd>
        <dt class="text-slate-500 dark:text-slate-400">{t.jobsProgress}</dt>
        <dd>
          {run.done + run.errors} {t.of} {run.total}
        </dd>
        <dt class="text-slate-500 dark:text-slate-400">{t.duplicatesSkipped}</dt>
        <dd>{run.skipped}</dd>
        <dt class="text-slate-500 dark:text-slate-400">{t.errors}</dt>
        <dd class={run.errors ? 'text-rose-700 dark:text-rose-400' : ''}>{run.errors}</dd>
      </dl>

      {run.phase === 'details' && (
        <div class="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
          <div class="h-full bg-teal-600 transition-all" style={{ width: `${percent}%` }} />
        </div>
      )}

      {run.current && (
        <div class="text-xs">
          <span class="text-slate-500 dark:text-slate-400">{t.current}: </span>
          <span class="break-all">{run.current}</span>
        </div>
      )}
      {run.errors > 0 && run.lastError && run.status !== 'error' && (
        <p class="text-[11px] break-all text-rose-700 dark:text-rose-400">{run.lastError}</p>
      )}

      <div class="flex gap-2">
        {run.status === 'running' && (
          <button class="btn flex-1" onClick={() => void act('pause')}>
            {t.pause}
          </button>
        )}
        {canResume && (
          <button class="btn btn-primary flex-1" onClick={() => void act('resume')}>
            {t.resume}
          </button>
        )}
        <button class="btn btn-danger" onClick={() => void act('cancel')}>
          {t.cancel}
        </button>
      </div>
    </section>
  );
}
