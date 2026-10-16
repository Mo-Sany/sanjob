/**
 * XLSX export: one sheet, one Excel Table, frozen header row, wrapped text with a capped
 * row height, auto column widths and clickable URLs.
 *
 * SheetJS (community edition) writes the cells, widths, heights and hyperlinks. It cannot
 * write cell styles, frozen panes or Excel Tables, so `enhanceWorkbook` adds those parts to
 * the generated OOXML package afterwards (plain XML, no extra dependency besides fflate).
 */
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import * as XLSX from 'xlsx';
import { splitSections, type JobSections } from '../sections/split';
import type { JobColumn, JobData, Language } from '../shared/types';

export const MAX_CELL_CHARS = 32000;
export const TRUNCATED_SUFFIX = ' [truncated]';
/** Row height cap in points (≈ 8 lines) so long descriptions do not create giant rows. */
export const MAX_ROW_HEIGHT_PT = 120;
const LINE_HEIGHT_PT = 15;

/** Tracking + CV match columns (only when this data is passed to buildXlsx). */
export type FitColumn =
  'status' | 'notes' | 'fitScore' | 'fitLevel' | 'keywords' | 'inCv' | 'missing' | 'aiVerdict';
export type FitCells = Record<FitColumn, string> & { score: number | null };
type ExportColumn = JobColumn | FitColumn;

const BASE_COLUMNS: Array<{ key: JobColumn; maxWidth: number }> = [
  { key: 'title', maxWidth: 50 },
  { key: 'company', maxWidth: 35 },
  { key: 'location', maxWidth: 30 },
  { key: 'datePosted', maxWidth: 14 },
  { key: 'salary', maxWidth: 28 },
  { key: 'contractType', maxWidth: 25 },
  { key: 'url', maxWidth: 45 },
];

const FIT_COLUMNS: Array<{ key: FitColumn; maxWidth: number }> = [
  { key: 'status', maxWidth: 22 },
  { key: 'notes', maxWidth: 40 },
  { key: 'fitScore', maxWidth: 10 },
  { key: 'fitLevel', maxWidth: 18 },
  { key: 'keywords', maxWidth: 50 },
  { key: 'inCv', maxWidth: 40 },
  { key: 'missing', maxWidth: 40 },
  { key: 'aiVerdict', maxWidth: 60 },
];

const TEXT_COLUMNS: Array<{ key: JobColumn; maxWidth: number }> = [
  { key: 'description', maxWidth: 100 },
  { key: 'tasks', maxWidth: 70 },
  { key: 'profile', maxWidth: 70 },
  { key: 'offer', maxWidth: 60 },
  { key: 'other', maxWidth: 60 },
];

/** Columns without match data (the default layout). */
export const COLUMNS: Array<{ key: ExportColumn; maxWidth: number }> = [
  ...BASE_COLUMNS,
  ...TEXT_COLUMNS,
];

export const HEADERS: Record<Language, Record<ExportColumn, string>> = {
  en: {
    title: 'Title',
    company: 'Company',
    location: 'Location',
    datePosted: 'Date posted',
    salary: 'Salary',
    contractType: 'Contract type',
    url: 'URL',
    description: 'Description',
    tasks: 'Your tasks',
    profile: 'Your profile',
    offer: 'We offer',
    other: 'Other',
    status: 'Status',
    notes: 'Notes',
    fitScore: 'Fit %',
    fitLevel: 'Fit',
    keywords: 'Keywords',
    inCv: 'In my CV',
    missing: 'Missing in my CV',
    aiVerdict: 'AI verdict',
  },
  de: {
    title: 'Titel',
    company: 'Unternehmen',
    location: 'Ort',
    datePosted: 'Veröffentlicht',
    salary: 'Gehalt',
    contractType: 'Vertragsart',
    url: 'URL',
    description: 'Beschreibung',
    tasks: 'Ihre Aufgaben',
    profile: 'Ihr Profil',
    offer: 'Wir bieten',
    other: 'Sonstiges',
    status: 'Status',
    notes: 'Notizen',
    fitScore: 'Passung %',
    fitLevel: 'Passung',
    keywords: 'Schlüsselwörter',
    inCv: 'In meinem Lebenslauf',
    missing: 'Fehlt im Lebenslauf',
    aiVerdict: 'KI-Fazit',
  },
};

/** Excel allows 32,767 characters per cell; we cut at 32,000 and mark the cut. */
export function truncateCell(value: string): string {
  return value.length > MAX_CELL_CHARS ? value.slice(0, MAX_CELL_CHARS) + TRUNCATED_SUFFIX : value;
}

/** Strips characters that are invalid in XML 1.0 (they would corrupt the file). */
function cleanXmlChars(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g, '');
}

function estimateLines(text: string, width: number): number {
  return text
    .split('\n')
    .reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / Math.max(width, 1))), 0);
}

export function columnWidths(
  rows: string[][],
  columns: Array<{ maxWidth: number }> = COLUMNS,
): number[] {
  return columns.map((col, i) => {
    const longest = rows.reduce((max, row) => {
      const firstLine = (row[i] ?? '').split('\n')[0] ?? '';
      return Math.max(max, Math.min(firstLine.length, 200));
    }, 0);
    return Math.max(10, Math.min(col.maxWidth, longest + 2));
  });
}

export function rowHeight(row: string[], widths: number[]): number {
  const lines = row.reduce(
    (max, cell, i) => Math.max(max, estimateLines(cell, widths[i] ?? 10)),
    1,
  );
  return Math.min(MAX_ROW_HEIGHT_PT, Math.max(LINE_HEIGHT_PT, lines * LINE_HEIGHT_PT));
}

const xmlEscape = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * The job as exported: when sections were found, "Beschreibung" holds only the intro so that
 * every text fragment appears in exactly one column. Records collected before the intro
 * existed are split again from their plain-text description.
 */
export function exportedJob(job: JobData): JobData {
  let parts: JobSections = {
    intro: job.intro ?? '',
    tasks: job.tasks,
    profile: job.profile,
    offer: job.offer,
    other: job.other,
  };
  const found = (p: JobSections): boolean => Boolean(p.tasks || p.profile || p.offer);
  if (job.intro === undefined) {
    const again = splitSections(job.description);
    // Nothing found in the plain text: keep the record as it was collected.
    if (!found(again)) return job;
    parts = again;
  }
  if (!found(parts)) return { ...job, tasks: '', profile: '', offer: '', other: '' };
  return { ...job, ...parts, description: parts.intro };
}

/** Builds the .xlsx file for the given jobs. */
export function buildXlsx(
  jobs: JobData[],
  lang: Language = 'en',
  fit?: Map<string, FitCells>,
): Uint8Array {
  const columns: Array<{ key: ExportColumn; maxWidth: number }> = fit
    ? [...BASE_COLUMNS, ...FIT_COLUMNS, ...TEXT_COLUMNS]
    : COLUMNS;
  const headers = columns.map((c) => HEADERS[lang][c.key]);
  const fitKeys = new Set<ExportColumn>(FIT_COLUMNS.map((c) => c.key));
  const cellOf = (job: JobData, key: ExportColumn): string =>
    fitKeys.has(key)
      ? (fit?.get(job.url)?.[key as FitColumn] ?? '')
      : (job[key as JobColumn] ?? '');
  const exported = jobs.map(exportedJob);
  const rows = exported.map((job) =>
    columns.map((c) => truncateCell(cleanXmlChars(cellOf(job, c.key)))),
  );
  // The score is a real number so Excel sorts and filters it numerically.
  const scoreCol = columns.findIndex((c) => c.key === 'fitScore');
  const cells: Array<Array<string | number>> = rows.map((row, r) => {
    const score = fit?.get(exported[r]!.url)?.score;
    return scoreCol >= 0 && typeof score === 'number'
      ? row.map((v, c) => (c === scoreCol ? score : v))
      : row;
  });
  const ws = XLSX.utils.aoa_to_sheet([headers, ...cells]);

  const urlCol = columns.findIndex((c) => c.key === 'url');
  rows.forEach((row, r) => {
    const url = row[urlCol];
    if (url && /^https?:\/\//i.test(url)) {
      const ref = XLSX.utils.encode_cell({ r: r + 1, c: urlCol });
      const cell = ws[ref] as XLSX.CellObject | undefined;
      if (cell) cell.l = { Target: url };
    }
  });

  const widths = columnWidths([headers, ...rows], columns);
  ws['!cols'] = widths.map((wch) => ({ wch }));
  ws['!rows'] = [{ hpt: 20 }, ...rows.map((row) => ({ hpt: rowHeight(row, widths) }))];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Jobs');
  const raw = XLSX.write(wb, {
    type: 'array',
    bookType: 'xlsx',
    bookSST: true,
    compression: true,
  }) as ArrayBuffer;
  return enhanceWorkbook(new Uint8Array(raw), headers, Math.max(rows.length, 1), urlCol);
}

const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const REL_TABLE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/table';
const CT_TABLE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml';
const STYLE_WRAP = 1;
const STYLE_LINK = 2;

function colLetter(index: number): string {
  return XLSX.utils.encode_col(index);
}

/** Adds wrap/link styles, a frozen header row and an Excel Table to a SheetJS workbook. */
export function enhanceWorkbook(
  data: Uint8Array,
  headers: string[],
  dataRows: number,
  urlCol: number,
): Uint8Array {
  const files = unzipSync(data);
  const read = (path: string): string => {
    const f = files[path];
    if (!f) throw new Error(`xlsx: missing ${path}`);
    return strFromU8(f);
  };
  const lastCol = colLetter(headers.length - 1);
  const ref = `A1:${lastCol}${dataRows + 1}`;

  // 1) Styles: font 1 = hyperlink; xf 1 = wrap + top; xf 2 = hyperlink + wrap + top.
  let styles = read('xl/styles.xml');
  styles = styles.replace(/<fonts count="1">([\s\S]*?)<\/fonts>/, (_m, font: string) => {
    const link =
      '<font><u/><sz val="12"/><color rgb="FF0563C1"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font>';
    return `<fonts count="2">${font}${link}</fonts>`;
  });
  styles = styles.replace(/<cellXfs count="1">([\s\S]*?)<\/cellXfs>/, (_m, xf: string) => {
    const align = '<alignment vertical="top" wrapText="1"/>';
    return (
      `<cellXfs count="3">${xf}` +
      `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1">${align}</xf>` +
      `<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1">${align}</xf>` +
      `</cellXfs>`
    );
  });
  files['xl/styles.xml'] = strToU8(styles);

  // 2) Sheet: styles on cells, frozen first row, table part.
  let sheet = read('xl/worksheets/sheet1.xml');
  const urlLetter = colLetter(urlCol);
  sheet = sheet.replace(/<c r="([A-Z]+)(\d+)"(?![^>]*\ss=)/g, (_m, col: string, row: string) => {
    const style = col === urlLetter && row !== '1' ? STYLE_LINK : STYLE_WRAP;
    return `<c r="${col}${row}" s="${style}"`;
  });
  const pane =
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' +
    '<selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews>';
  sheet = sheet.replace(/<sheetViews>[\s\S]*?<\/sheetViews>/, pane);
  if (!sheet.includes('<sheetViews>')) sheet = sheet.replace(/(<dimension [^>]*\/>)/, `$1${pane}`);
  sheet = sheet.replace(
    '</worksheet>',
    '<tableParts count="1"><tablePart r:id="rIdSanjobTable"/></tableParts></worksheet>',
  );
  if (!sheet.includes('xmlns:r=')) {
    sheet = sheet.replace(
      '<worksheet ',
      '<worksheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ',
    );
  }
  files['xl/worksheets/sheet1.xml'] = strToU8(sheet);

  // 3) Sheet relationships → table.
  const relsPath = 'xl/worksheets/_rels/sheet1.xml.rels';
  const tableRel = `<Relationship Id="rIdSanjobTable" Type="${REL_TABLE}" Target="../tables/table1.xml"/>`;
  const rels = files[relsPath]
    ? strFromU8(files[relsPath]).replace('</Relationships>', `${tableRel}</Relationships>`)
    : `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${tableRel}</Relationships>`;
  files[relsPath] = strToU8(rels);

  // 4) The table itself.
  const cols = headers
    .map((h, i) => `<tableColumn id="${i + 1}" name="${xmlEscape(h)}"/>`)
    .join('');
  files['xl/tables/table1.xml'] = strToU8(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
      `<table xmlns="${NS_MAIN}" id="1" name="Jobs" displayName="Jobs" ref="${ref}" totalsRowShown="0">` +
      `<autoFilter ref="${ref}"/><tableColumns count="${headers.length}">${cols}</tableColumns>` +
      `<tableStyleInfo name="TableStyleMedium2" showFirstColumn="0" showLastColumn="0" showRowStripes="1" showColumnStripes="0"/>` +
      `</table>`,
  );

  // 5) Content type for the table part.
  const ct = read('[Content_Types].xml').replace(
    '</Types>',
    `<Override PartName="/xl/tables/table1.xml" ContentType="${CT_TABLE}"/></Types>`,
  );
  files['[Content_Types].xml'] = strToU8(ct);

  return zipSync(files, { level: 6 });
}

export function exportFileName(now: Date = new Date()): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `sanjob-jobs-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}.xlsx`;
}
