import { fmt, formatNumber, type Strings } from '../../shared/i18n';
import type { JobRecord, RunState, Settings } from '../../shared/types';
import type { Notify } from '../App';
import { exportJobs } from '../exporting';

interface Props {
  t: Strings;
  run: RunState;
  jobs: JobRecord[];
  lastRunId: string | null;
  settings: Settings;
  notify: Notify;
  onOpenTable: () => void;
  onClose: () => void;
}

/** Shown when a run has finished: what happened, and the two obvious next steps. */
export function SummaryCard({
  t,
  run,
  jobs,
  lastRunId,
  settings,
  notify,
  onOpenTable,
  onClose,
}: Props) {
  const n = (x: number): string => formatNumber(x, settings.language);
  const download = (): void => {
    const count = exportJobs(jobs, lastRunId, settings);
    notify(count ? t.exported : t.nothingToExport, count ? 'success' : 'info');
  };

  return (
    <section class="card animate-in flex flex-col gap-3">
      <div class="flex items-start gap-2">
        <h2 class="flex-1 text-base font-semibold">
          {run.done > 0 ? t.summaryTitle : t.summaryEmpty}
        </h2>
        <button
          class="text-slate-400 hover:text-slate-600"
          aria-label={t.dismiss}
          onClick={onClose}
        >
          ✕
        </button>
      </div>
      <p class="text-slate-700 dark:text-slate-200">
        {fmt(t.summaryLine, {
          c: n(run.done),
          s: n(run.skipped),
          f: n(run.filtered ?? 0),
          u: n(run.errors),
        })}
      </p>
      <div class="flex flex-wrap gap-2">
        <button class="btn btn-primary flex-1" onClick={download} disabled={!jobs.length}>
          ⬇ {t.downloadExcel}
        </button>
        <button class="btn flex-1" onClick={onOpenTable}>
          {t.openTable}
        </button>
      </div>
      <button
        class="self-start text-xs text-teal-700 hover:underline dark:text-teal-300"
        onClick={onClose}
      >
        + {t.newCollection}
      </button>
    </section>
  );
}
