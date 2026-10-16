import { buildXlsx, exportFileName, type FitCells } from '../export/xlsx';
import { levelOf, matchAll, type MatchResult } from '../match/local';
import { STRINGS } from '../shared/i18n';
import type { JobRecord, Settings } from '../shared/types';
import { downloadBytes } from './api';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** The match columns of one job: Claude's rating when there is one, else the local one. */
export function fitCells(
  job: JobRecord,
  match: MatchResult | undefined,
  settings: Settings,
): FitCells {
  const t = STRINGS[settings.language];
  const ai = job.ai;
  const score = ai?.score ?? match?.score ?? null;
  const keywords = ai?.keywords.length ? ai.keywords : (match?.keywords ?? []);
  return {
    score,
    status: job.status ? t.tracking[job.status] : '',
    notes: job.notes ?? '',
    fitScore: score === null ? '' : String(score),
    fitLevel: score === null ? '' : t.fit.levels[levelOf(score)],
    keywords: keywords.join(', '),
    inCv: (ai?.matched ?? match?.matched ?? []).join(', '),
    missing: (ai?.missing ?? match?.missing ?? []).join(', '),
    aiVerdict: ai?.verdict ?? '',
  };
}

/**
 * Downloads the Excel file. `exportAppend` on: every stored job; off: only the latest run.
 * Includes the CV match columns (keywords are filled even without a CV).
 * Returns the number of exported jobs (0 = nothing to export).
 */
export function exportJobs(
  jobs: JobRecord[],
  lastRunId: string | null,
  settings: Settings,
  matches: Map<string, MatchResult> = matchAll(jobs, settings.cvText),
): number {
  const list = settings.exportAppend ? jobs : jobs.filter((j) => j.runId === lastRunId);
  if (!list.length) return 0;
  const ordered = [...list].sort((a, b) => a.collectedAt - b.collectedAt);
  const fit = new Map(ordered.map((j) => [j.url, fitCells(j, matches.get(j.url), settings)]));
  downloadBytes(buildXlsx(ordered, settings.language, fit), exportFileName(), XLSX_MIME);
  return ordered.length;
}
