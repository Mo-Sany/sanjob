import { Fragment, type RefObject } from 'preact';
import { useMemo, useRef, useState } from 'preact/hooks';
import { AiError, loadApiKey, rateJobs } from '../../claude/api';
import { getProvider } from '../../claude/provider';
import { repo } from '../../db/db';
import { matchAll } from '../../match/local';
import { fmt, type Strings } from '../../shared/i18n';
import {
  JOB_STATUSES,
  SECTION_FIELDS,
  type JobColumn,
  type JobRecord,
  type JobStatus,
  type Settings,
} from '../../shared/types';
import type { Notify } from '../App';
import { exportJobs } from '../exporting';
import { filterJobs, sortJobs, type SortDir, type SortKey } from '../table';
import { BestMatches, FitBadge, FitDetails, fitScore } from './Fit';

const STATUS_CLASS: Record<JobStatus | 'none', string> = {
  none: 'border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800',
  interested: 'border-sky-300 bg-sky-50 text-sky-900 dark:bg-sky-900 dark:text-sky-50',
  applied: 'border-indigo-300 bg-indigo-50 text-indigo-900 dark:bg-indigo-900 dark:text-indigo-50',
  interview: 'border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-900 dark:text-amber-50',
  offer:
    'border-emerald-400 bg-emerald-50 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-50',
  rejected: 'border-slate-300 bg-slate-100 text-slate-500 line-through dark:bg-slate-700',
};

/** How many of the best local matches "Rate top N with AI" sends. */
const AI_TOP = 10;

interface Props {
  t: Strings;
  settings: Settings;
  update: (patch: Partial<Settings>) => Promise<void>;
  jobs: JobRecord[];
  lastRunId: string | null;
  reload: () => Promise<void>;
  notify: Notify;
  sectionRef: RefObject<HTMLElement | null>;
  openSettings: () => void;
}

const VISIBLE: Array<JobColumn> = [
  'title',
  'company',
  'location',
  'datePosted',
  'salary',
  'contractType',
];

export function JobTable({
  t,
  settings,
  update,
  jobs,
  lastRunId,
  reload,
  notify,
  sectionRef,
  openSettings,
}: Props) {
  const hasCv = settings.cvText.trim() !== '';
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>(hasCv ? 'fit' : 'collectedAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [expanded, setExpanded] = useState<number | null>(null);
  const [aiProgress, setAiProgress] = useState<{ done: number; total: number } | null>(null);
  const aiAbort = useRef<AbortController | null>(null);

  // Local matching: keywords for every job, scores when a CV exists (recomputed on change).
  // Keyed by the job URLs, so saving an AI rating does not recompute everything.
  const jobsKey = jobs.map((j) => j.url).join('\n');
  const matches = useMemo(() => matchAll(jobs, settings.cvText), [jobsKey, settings.cvText]);
  const fitOf = useMemo(() => {
    const map = new Map<string, number | null>();
    for (const job of jobs) map.set(job.url, fitScore(job, matches.get(job.url)));
    return map;
  }, [jobs, matches]);

  const [statusFilter, setStatusFilter] = useState<'all' | 'none' | JobStatus>('all');
  const fitMin = hasCv ? settings.fitMin : 0;

  const rows = useMemo(() => {
    const visible = filterJobs(jobs, query).filter((job) => {
      if (fitMin > 0 && (fitOf.get(job.url) ?? -1) < fitMin) return false;
      if (statusFilter === 'none') return !job.status;
      return statusFilter === 'all' || job.status === statusFilter;
    });
    return sortJobs(visible, sortKey, sortDir, fitOf);
  }, [jobs, query, sortKey, sortDir, fitOf, fitMin, statusFilter]);
  const hiddenByFilters = filterJobs(jobs, query).length - rows.length;
  const selectedJobs = jobs.filter((j) => j.id !== undefined && selected.has(j.id));
  const allVisibleSelected =
    rows.length > 0 && rows.every((r) => r.id !== undefined && selected.has(r.id));

  const toggleSort = (key: SortKey): void => {
    if (key === sortKey) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else {
      setSortKey(key);
      setSortDir(key === 'fit' ? 'desc' : 'asc');
    }
  };

  const toggle = (id: number | undefined): void => {
    if (id === undefined) return;
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const toggleAll = (): void => {
    const next = new Set(selected);
    for (const r of rows) {
      if (r.id === undefined) continue;
      if (allVisibleSelected) next.delete(r.id);
      else next.add(r.id);
    }
    setSelected(next);
  };

  const remove = async (ids: number[]): Promise<void> => {
    if (!ids.length) return;
    if (ids.length > 1 && !confirm(fmt(t.confirmDelete, { n: ids.length }))) return;
    await repo.deleteJobs(ids);
    const next = new Set(selected);
    ids.forEach((id) => next.delete(id));
    setSelected(next);
    await reload();
    notify(fmt(t.deleted, { n: ids.length }), 'info');
  };

  const match = async (targets: JobRecord[]): Promise<void> => {
    if (!settings.cvText.trim()) return notify(t.needCv, 'info');
    if (!targets.length) return notify(t.selectJobsFirst, 'info');
    const provider = getProvider({
      writeText: (text) => navigator.clipboard.writeText(text),
    });
    try {
      await provider.run({ cv: settings.cvText, jobs: targets, lang: settings.language });
      notify(t.promptCopied);
    } catch (err) {
      console.warn('[Sanjob] clipboard', err);
      notify(t.copyBlocked, 'warn');
    }
  };

  const rateWithAi = async (targets: JobRecord[]): Promise<void> => {
    if (!hasCv) return notify(t.needCv, 'info');
    const apiKey = settings.aiEnabled ? await loadApiKey() : '';
    if (!apiKey) return notify(t.ai.needKey, 'info');
    if (!targets.length) return notify(t.selectJobsFirst, 'info');
    const abort = new AbortController();
    aiAbort.current = abort;
    let done = 0;
    let skipped: AiError | null = null;
    setAiProgress({ done, total: targets.length });
    try {
      await rateJobs({
        apiKey,
        cv: settings.cvText,
        jobs: targets,
        model: settings.aiModel,
        lang: settings.language,
        signal: abort.signal,
        onResult: async (job, rating, problem) => {
          const id = (job as JobRecord).id;
          if (rating && id !== undefined) await repo.setAiRating(id, rating);
          if (problem) skipped = problem;
          setAiProgress({ done: ++done, total: targets.length });
          await reload();
        },
      });
      if (abort.signal.aborted) notify(fmt(t.ai.stopped, { n: done }), 'info');
      else if (skipped) notify(t.ai.problems[(skipped as AiError).code], 'info');
      else notify(fmt(t.ai.done, { n: done }));
      if (!abort.signal.aborted) {
        setSortKey('fit');
        setSortDir('desc');
      }
    } catch (err) {
      const code = err instanceof AiError ? err.code : 'other';
      console.warn('[Sanjob] AI rating', err);
      notify(t.ai.problems[code], 'warn');
    } finally {
      aiAbort.current = null;
      setAiProgress(null);
    }
  };

  const aiTargets = (): JobRecord[] =>
    selectedJobs.length
      ? selectedJobs
      : [...jobs]
          .sort((a, b) => (fitOf.get(b.url) ?? -1) - (fitOf.get(a.url) ?? -1))
          .slice(0, AI_TOP);

  const setTracking = async (
    job: JobRecord,
    patch: { status?: JobStatus | undefined; notes?: string },
  ): Promise<void> => {
    if (job.id === undefined) return;
    await repo.setTracking(job.id, patch);
    await reload();
  };

  const openJob = (job: JobRecord): void => {
    setQuery('');
    setStatusFilter('all');
    if (fitMin > 0) void update({ fitMin: 0 });
    setExpanded(job.id ?? null);
    requestAnimationFrame(() =>
      document
        .getElementById(`job-${job.id}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
    );
  };

  const exportXlsx = (): void => {
    const count = exportJobs(jobs, lastRunId, settings, matches);
    notify(count ? t.exported : t.nothingToExport, count ? 'success' : 'info');
  };

  const arrow = (key: SortKey): string =>
    key === sortKey ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';

  return (
    <section ref={sectionRef} class="card flex flex-col gap-2">
      <div class="flex items-center gap-2">
        <h2 class="flex-1 font-semibold">
          {t.table} <span class="text-slate-500">({jobs.length})</span>
        </h2>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <label class="flex items-center gap-1 text-xs">
          <input
            type="checkbox"
            checked={settings.exportAppend}
            onChange={() => void update({ exportAppend: !settings.exportAppend })}
          />
          <span title={t.appendHint}>{t.appendPrevious}</span>
        </label>
        <button class="btn btn-primary ml-auto" onClick={exportXlsx} disabled={!jobs.length}>
          {t.export}
        </button>
      </div>

      <BestMatches
        t={t}
        jobs={jobs}
        matches={matches}
        hasCv={hasCv}
        onOpen={openJob}
        onAddCv={openSettings}
      />

      <input
        type="search"
        class="input w-full"
        placeholder={t.search}
        value={query}
        onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
      />

      <div class="flex flex-wrap items-center gap-2 text-xs">
        {hasCv && (
          <label class="flex items-center gap-1">
            <span class="text-slate-500 dark:text-slate-400">{t.fit.filter}</span>
            <select
              class="input py-0.5"
              value={settings.fitMin}
              onChange={(e) =>
                void update({ fitMin: Number((e.target as HTMLSelectElement).value) })
              }
            >
              <option value={0}>{t.fit.filterAll}</option>
              {[40, 60, 80].map((n) => (
                <option key={n} value={n}>
                  {fmt(t.fit.filterMin, { n })}
                </option>
              ))}
            </select>
          </label>
        )}
        <label class="flex items-center gap-1">
          <span class="text-slate-500 dark:text-slate-400">{t.tracking.label}</span>
          <select
            class="input py-0.5"
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter((e.target as HTMLSelectElement).value as typeof statusFilter)
            }
          >
            <option value="all">{t.tracking.filterAll}</option>
            <option value="none">{t.tracking.none}</option>
            {JOB_STATUSES.map((st) => (
              <option key={st} value={st}>
                {t.tracking[st]}
              </option>
            ))}
          </select>
        </label>
        {hiddenByFilters > 0 && (
          <span class="text-slate-500 dark:text-slate-400">
            {fmt(t.fit.hidden, { n: hiddenByFilters })}
          </span>
        )}
      </div>

      <div class="flex flex-wrap gap-2">
        <button
          class="btn"
          disabled={!selectedJobs.length}
          onClick={() => void match(selectedJobs)}
        >
          {t.matchSelected} {selectedJobs.length ? `(${selectedJobs.length})` : ''}
        </button>
        {settings.aiEnabled &&
          (aiProgress ? (
            <span class="flex items-center gap-2 text-xs">
              <span class="animate-pulse">
                {fmt(t.ai.running, { done: aiProgress.done + 1, n: aiProgress.total })}
              </span>
              <button class="btn" onClick={() => aiAbort.current?.abort()}>
                {t.ai.stop}
              </button>
            </span>
          ) : (
            <button
              class="btn btn-primary"
              disabled={!jobs.length}
              onClick={() => void rateWithAi(aiTargets())}
            >
              ✨{' '}
              {selectedJobs.length
                ? `${t.ai.rateSelected} (${selectedJobs.length})`
                : fmt(t.ai.rateTop, { n: Math.min(AI_TOP, jobs.length) })}
            </button>
          ))}
        <button
          class="btn btn-danger"
          disabled={!selectedJobs.length}
          onClick={() => void remove(selectedJobs.map((j) => j.id!))}
        >
          {t.deleteSelected}
        </button>
      </div>

      {jobs.length === 0 ? (
        <div class="flex flex-col items-center gap-1 py-6 text-center">
          <span class="text-3xl">📋</span>
          <p class="font-medium">{t.noJobs}</p>
          <p class="max-w-xs text-xs text-slate-500 dark:text-slate-400">{t.noJobsHint}</p>
        </div>
      ) : rows.length === 0 ? (
        <p class="py-6 text-center text-xs text-slate-500 dark:text-slate-400">{t.noMatches}</p>
      ) : (
        <div class="max-h-[60vh] overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">
          <table class="w-full border-collapse text-xs">
            <thead class="sticky top-0 bg-slate-100 dark:bg-slate-900">
              <tr>
                <th class="w-6 p-1">
                  <input
                    type="checkbox"
                    aria-label={t.selectAll}
                    checked={allVisibleSelected}
                    onChange={toggleAll}
                  />
                </th>
                <th
                  class="cursor-pointer p-1 text-left font-semibold whitespace-nowrap select-none"
                  title={t.fit.sortByFit}
                  onClick={() => toggleSort('fit')}
                >
                  {t.fit.column}
                  {arrow('fit')}
                </th>
                <th class="p-1 text-left font-semibold whitespace-nowrap">{t.tracking.label}</th>
                {VISIBLE.map((key) => (
                  <th
                    key={key}
                    class="cursor-pointer p-1 text-left font-semibold whitespace-nowrap select-none"
                    onClick={() => toggleSort(key)}
                  >
                    {t.columns[key]}
                    {arrow(key)}
                  </th>
                ))}
                <th class="p-1" />
              </tr>
            </thead>
            <tbody>
              {rows.map((job) => (
                <Fragment key={job.id}>
                  <tr
                    id={`job-${job.id}`}
                    class="border-t border-slate-200 align-top hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/40"
                  >
                    <td class="p-1">
                      <input
                        type="checkbox"
                        checked={job.id !== undefined && selected.has(job.id)}
                        onChange={() => toggle(job.id)}
                      />
                    </td>
                    <td class="p-1">
                      <FitBadge t={t} job={job} match={matches.get(job.url)} />
                    </td>
                    <td class="p-1">
                      <select
                        class={`rounded border px-0.5 py-0.5 text-[11px] ${STATUS_CLASS[job.status ?? 'none']}`}
                        aria-label={t.tracking.label}
                        value={job.status ?? ''}
                        onChange={(e) => {
                          const v = (e.target as HTMLSelectElement).value as JobStatus | '';
                          void setTracking(job, { status: v || undefined });
                        }}
                      >
                        <option value="">{t.tracking.none}</option>
                        {JOB_STATUSES.map((st) => (
                          <option key={st} value={st}>
                            {t.tracking[st]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td class="min-w-40 p-1">
                      <button
                        class="text-left font-medium text-teal-800 hover:underline dark:text-teal-300"
                        onClick={() => setExpanded(expanded === job.id ? null : (job.id ?? null))}
                      >
                        {job.title || '—'}
                      </button>
                    </td>
                    <td class="p-1">{job.company}</td>
                    <td class="p-1">{job.location}</td>
                    <td class="p-1 whitespace-nowrap">{job.datePosted}</td>
                    <td class="p-1">{job.salary}</td>
                    <td class="p-1">{job.contractType}</td>
                    <td class="p-1 whitespace-nowrap">
                      <a
                        class="mr-1"
                        href={job.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        title={job.url}
                      >
                        ↗
                      </a>
                      <button class="mr-1" title={t.copyPrompt} onClick={() => void match([job])}>
                        ✦
                      </button>
                      <button
                        title={t.deleteRow}
                        class="text-rose-700 dark:text-rose-400"
                        onClick={() => job.id !== undefined && void remove([job.id])}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                  {expanded === job.id && (
                    <tr class="animate-in bg-slate-50 dark:bg-slate-900/60">
                      <td />
                      <td colSpan={9} class="p-2">
                        <a
                          class="break-all text-teal-800 dark:text-teal-300"
                          href={job.url}
                          target="_blank"
                          rel="noreferrer noopener"
                        >
                          {job.url}
                        </a>
                        <FitDetails t={t} job={job} match={matches.get(job.url)} hasCv={hasCv} />
                        <label class="mt-2 flex flex-col gap-1">
                          <span class="text-[11px] font-semibold text-slate-500 uppercase">
                            {t.tracking.notes}
                          </span>
                          <textarea
                            key={`notes-${job.id}`}
                            class="input min-h-16 text-xs"
                            placeholder={t.tracking.notesPlaceholder}
                            defaultValue={job.notes ?? ''}
                            onBlur={(e) => {
                              const notes = (e.target as HTMLTextAreaElement).value;
                              if (notes !== (job.notes ?? '')) void setTracking(job, { notes });
                            }}
                          />
                        </label>
                        {SECTION_FIELDS.some((f) => job[f]) ? (
                          <div class="mt-2 grid gap-2 sm:grid-cols-2">
                            {SECTION_FIELDS.filter((f) => job[f]).map((f) => (
                              <div key={f} class="rounded-lg bg-white p-2 dark:bg-slate-800">
                                <div class="mb-1 text-[11px] font-semibold text-slate-500 uppercase dark:text-slate-400">
                                  {t.columns[f]}
                                </div>
                                <pre class="max-h-48 overflow-auto font-sans text-xs whitespace-pre-wrap">
                                  {job[f]}
                                </pre>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <pre class="mt-2 max-h-80 overflow-auto font-sans text-xs whitespace-pre-wrap">
                            {job.description}
                          </pre>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
