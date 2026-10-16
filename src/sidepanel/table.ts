import type { JobData, JobRecord } from '../shared/types';

/** 'fit' sorts by the CV match score (AI score when available). */
export type SortKey = keyof JobData | 'collectedAt' | 'fit';
export type SortDir = 'asc' | 'desc';

const SEARCH_FIELDS: Array<keyof JobData> = [
  'title',
  'company',
  'location',
  'datePosted',
  'salary',
  'contractType',
  'url',
  'description',
];

/** Case-insensitive search over all columns; every word must match. */
export function filterJobs(jobs: JobRecord[], query: string): JobRecord[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return jobs;
  return jobs.filter((job) => {
    const hay = SEARCH_FIELDS.map((f) => job[f])
      .join('\n')
      .toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

export function sortJobs(
  jobs: JobRecord[],
  key: SortKey,
  dir: SortDir,
  fit?: Map<string, number | null>,
): JobRecord[] {
  const factor = dir === 'asc' ? 1 : -1;
  const value = (job: JobRecord): unknown =>
    key === 'fit' ? (fit?.get(job.url) ?? undefined) : job[key];
  return [...jobs].sort((a, b) => {
    const av = value(a);
    const bv = value(b);
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * factor;
    const as = String(av ?? '');
    const bs = String(bv ?? '');
    // Empty values always last.
    if (!as && bs) return 1;
    if (as && !bs) return -1;
    return as.localeCompare(bs, undefined, { numeric: true, sensitivity: 'base' }) * factor;
  });
}
