import { strFromU8, unzipSync } from 'fflate';
import * as XLSX from 'xlsx';
import { MAX_CELL_CHARS, MAX_ROW_HEIGHT_PT, buildXlsx, truncateCell } from '../src/export/xlsx';
import type { JobData } from '../src/shared/types';

const job = (over: Partial<JobData> = {}): JobData => ({
  title: 'Elektroniker (m/w/d)',
  company: 'Müller & Söhne GmbH',
  location: 'Köln',
  datePosted: '2026-10-01',
  salary: '45.000 € / Jahr',
  contractType: 'Vollzeit',
  url: 'https://www.stepstone.de/stellenangebote--x--1-inline.html',
  description: 'Größe <b> & "Übung"\nZweite Zeile',
  tasks: '',
  profile: '',
  offer: '',
  other: '',
  ...over,
});

describe('xlsx export', () => {
  const jobs = [
    job(),
    job({ title: 'Mechatroniker', url: 'https://de.indeed.com/viewjob?jk=abc', salary: '' }),
  ];
  const bytes = buildXlsx(jobs, 'en');
  const files = unzipSync(bytes);
  const sheetXml = strFromU8(files['xl/worksheets/sheet1.xml']!);

  it('writes one sheet with header row and one row per job (UTF-8 safe)', () => {
    const wb = XLSX.read(bytes, { type: 'array' });
    expect(wb.SheetNames).toEqual(['Jobs']);
    const rows = XLSX.utils.sheet_to_json<string[]>(wb.Sheets['Jobs']!, { header: 1, defval: '' });
    expect(rows[0]).toEqual([
      'Title',
      'Company',
      'Location',
      'Date posted',
      'Salary',
      'Contract type',
      'URL',
      'Description',
      'Your tasks',
      'Your profile',
      'We offer',
      'Other',
    ]);
    expect(rows).toHaveLength(3);
    expect(rows[1]).toEqual([
      'Elektroniker (m/w/d)',
      'Müller & Söhne GmbH',
      'Köln',
      '2026-10-01',
      '45.000 € / Jahr',
      'Vollzeit',
      'https://www.stepstone.de/stellenangebote--x--1-inline.html',
      'Größe <b> & "Übung"\nZweite Zeile',
      '',
      '',
      '',
      '',
    ]);
    expect(rows[2]?.[4]).toBe('');
  });

  it('uses German headers when the UI is German', () => {
    const wb = XLSX.read(buildXlsx(jobs, 'de'), { type: 'array' });
    const rows = XLSX.utils.sheet_to_json<string[]>(wb.Sheets['Jobs']!, { header: 1 });
    expect(rows[0]?.[0]).toBe('Titel');
    expect(rows[0]?.slice(7)).toEqual([
      'Beschreibung',
      'Ihre Aufgaben',
      'Ihr Profil',
      'Wir bieten',
      'Sonstiges',
    ]);
  });

  it('writes the four section columns after the description', () => {
    const wb = XLSX.read(
      buildXlsx([job({ tasks: '• A\n• B', profile: '• C', offer: '• D', other: 'E' })], 'de'),
      { type: 'array' },
    );
    const ws = wb.Sheets['Jobs']!;
    expect((ws['I2'] as XLSX.CellObject).v).toBe('• A\n• B');
    expect((ws['J2'] as XLSX.CellObject).v).toBe('• C');
    expect((ws['K2'] as XLSX.CellObject).v).toBe('• D');
    expect((ws['L2'] as XLSX.CellObject).v).toBe('E');
  });

  it('formats the data as an Excel Table', () => {
    const table = strFromU8(files['xl/tables/table1.xml']!);
    expect(table).toContain('ref="A1:L3"');
    expect(table).toContain('<tableColumn id="1" name="Title"/>');
    expect(table).toContain('<autoFilter ref="A1:L3"/>');
    expect(sheetXml).toContain('<tablePart r:id="rIdSanjobTable"/>');
    expect(strFromU8(files['xl/worksheets/_rels/sheet1.xml.rels']!)).toContain(
      '../tables/table1.xml',
    );
    expect(strFromU8(files['[Content_Types].xml']!)).toContain('/xl/tables/table1.xml');
  });

  it('freezes the header row', () => {
    expect(sheetXml).toContain(
      '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>',
    );
  });

  it('wraps text, caps row heights and sets column widths', () => {
    expect(strFromU8(files['xl/styles.xml']!)).toContain('wrapText="1"');
    expect(sheetXml).toMatch(/<c r="H2" s="1"/);
    const wb = XLSX.read(bytes, { type: 'array', cellStyles: true });
    const ws = wb.Sheets['Jobs']!;
    expect(ws['!cols']?.length).toBe(12);
    expect(ws['!cols']?.[0]?.wch).toBeGreaterThanOrEqual(10);

    const long = buildXlsx([job({ description: 'x '.repeat(5000) })]);
    const heights = XLSX.read(long, { type: 'array', cellStyles: true }).Sheets['Jobs']!['!rows']!;
    expect(heights[1]?.hpt).toBe(MAX_ROW_HEIGHT_PT);
  });

  it('makes URLs clickable', () => {
    const wb = XLSX.read(bytes, { type: 'array' });
    const cell = wb.Sheets['Jobs']!['G2'] as XLSX.CellObject;
    expect(cell.l?.Target).toBe('https://www.stepstone.de/stellenangebote--x--1-inline.html');
    expect(sheetXml).toMatch(/<c r="G2" s="2"/);
  });

  it('truncates cells over 32,000 characters', () => {
    expect(truncateCell('a'.repeat(MAX_CELL_CHARS))).toHaveLength(MAX_CELL_CHARS);
    const cut = truncateCell('a'.repeat(40000));
    expect(cut.endsWith(' [truncated]')).toBe(true);
    expect(cut).toHaveLength(MAX_CELL_CHARS + ' [truncated]'.length);

    const wb = XLSX.read(buildXlsx([job({ description: 'ü'.repeat(50000) })]), { type: 'array' });
    const desc = (wb.Sheets['Jobs']!['H2'] as XLSX.CellObject).v as string;
    expect(desc).toBe('ü'.repeat(MAX_CELL_CHARS) + ' [truncated]');
  });

  it('removes characters that are invalid in XML', () => {
    const wb = XLSX.read(buildXlsx([job({ title: 'A\u0001B\u000bC' })]), { type: 'array' });
    expect((wb.Sheets['Jobs']!['A2'] as XLSX.CellObject).v).toBe('ABC');
  });
});
