import { Fragment, type RefObject } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import { getProvider } from '../../claude/provider';
import { repo } from '../../db/db';
import { fmt, type Strings } from '../../shared/i18n';
import { SECTION_FIELDS, type JobData, type JobRecord, type Settings } from '../../shared/types';
import type { Notify } from '../App';
import { exportJobs } from '../exporting';
import { filterJobs, sortJobs, type SortDir, type SortKey } from '../table';

interface Props {
  t: Strings;
  settings: Settings;
  update: (patch: Partial<Settings>) => Promise<void>;
  jobs: JobRecord[];
  lastRunId: string | null;
  reload: () => Promise<void>;
  notify: Notify;
  sectionRef: RefObject<HTMLElement | null>;
}

const VISIBLE: Array<keyof JobData> = [
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
}: Props) {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('collectedAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [expanded, setExpanded] = useState<number | null>(null);

  const rows = useMemo(
    () => sortJobs(filterJobs(jobs, query), sortKey, sortDir),
    [jobs, query, sortKey, sortDir],
  );
  const selectedJobs = jobs.filter((j) => j.id !== undefined && selected.has(j.id));
  const allVisibleSelected =
    rows.length > 0 && rows.every((r) => r.id !== undefined && selected.has(r.id));

  const toggleSort = (key: SortKey): void => {
    if (key === sortKey) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else {
      setSortKey(key);
      setSortDir('asc');
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
    const provider = getProvider(settings.claudeMode, {
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

  const exportXlsx = (): void => {
    const count = exportJobs(jobs, lastRunId, settings);
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

      <input
        type="search"
        class="input w-full"
        placeholder={t.search}
        value={query}
        onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
      />

      <div class="flex flex-wrap gap-2">
        <button
          class="btn"
          disabled={!selectedJobs.length}
          onClick={() => void match(selectedJobs)}
        >
          {t.matchSelected} {selectedJobs.length ? `(${selectedJobs.length})` : ''}
        </button>
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
                  <tr class="border-t border-slate-200 align-top hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/40">
                    <td class="p-1">
                      <input
                        type="checkbox"
                        checked={job.id !== undefined && selected.has(job.id)}
                        onChange={() => toggle(job.id)}
                      />
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
                      <td colSpan={7} class="p-2">
                        <a
                          class="break-all text-teal-800 dark:text-teal-300"
                          href={job.url}
                          target="_blank"
                          rel="noreferrer noopener"
                        >
                          {job.url}
                        </a>
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
