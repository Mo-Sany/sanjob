import { buildXlsx, exportFileName } from '../export/xlsx';
import type { JobRecord, Settings } from '../shared/types';
import { downloadBytes } from './api';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * Downloads the Excel file. `exportAppend` on: every stored job; off: only the latest run.
 * Returns the number of exported jobs (0 = nothing to export).
 */
export function exportJobs(
  jobs: JobRecord[],
  lastRunId: string | null,
  settings: Settings,
): number {
  const list = settings.exportAppend ? jobs : jobs.filter((j) => j.runId === lastRunId);
  if (!list.length) return 0;
  const ordered = [...list].sort((a, b) => a.collectedAt - b.collectedAt);
  downloadBytes(buildXlsx(ordered, settings.language), exportFileName(), XLSX_MIME);
  return ordered.length;
}
