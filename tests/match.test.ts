import { JSDOM } from 'jsdom';
import { strToU8, zipSync } from 'fflate';
import jobs from '../fixtures/sections/xing-export.json';
import { cvFileKind, docxText } from '../src/match/cvfile';
import {
  analyzeCv,
  buildCorpus,
  findSkills,
  levelOf,
  matchAll,
  matchJob,
  requirementLines,
  stem,
} from '../src/match/local';
import { splitSections } from '../src/sections/split';
import type { JobData } from '../src/shared/types';

const job = (over: Partial<JobData>): JobData => ({
  title: '',
  company: 'Muster GmbH',
  location: 'Bremen',
  datePosted: '',
  salary: '',
  contractType: '',
  url: `https://example.com/${Math.random()}`,
  description: '',
  tasks: '',
  profile: '',
  offer: '',
  other: '',
  ...over,
});

describe('findSkills', () => {
  it('finds dictionary skills by any spelling, as whole words only', () => {
    expect(
      findSkills('Sehr gute MS-Office-Kenntnisse, Erfahrung mit SolidWorks und Englischkenntnisse'),
    ).toEqual(['MS Office', 'SolidWorks', 'Englisch']);
    expect(findSkills('Programmierung in C++ und C#')).toEqual(['C++', 'C#']);
    expect(findSkills('Wir sitzen in Sapporo und Javaland')).toEqual([]);
    expect(findSkills('Teamplayer mit Führerschein Klasse B')).toEqual([
      'Führerschein',
      'Teamfähigkeit',
    ]);
  });
});

describe('stem', () => {
  it('matches singular/plural and inflected forms', () => {
    expect(stem('konstruktionen')).toBe(stem('konstruktion'));
    expect(stem('anlagen')).toBe(stem('anlage'));
    expect(stem('tool')).toBe('tool');
  });
});

describe('matchJob', () => {
  const cad = job({
    title: 'Praktikant Konstruktion (m/w/d)',
    tasks: '• Konstruktion von Bauteilen in CATIA\n• Erstellung technischer Zeichnungen',
    profile:
      '• Studium Maschinenbau\n• Erfahrung mit CATIA oder SolidWorks\n• Gute Englischkenntnisse\n• Teamfähigkeit',
  });
  const sales = job({
    title: 'Vertriebsmitarbeiter Außendienst',
    tasks: '• Neukundengewinnung\n• Kundenbetreuung vor Ort',
    profile: '• Abgeschlossene kaufmännische Ausbildung\n• Führerschein Klasse B\n• Französisch',
  });
  const corpus = buildCorpus([cad, sales]);
  const cv = analyzeCv(
    'Student Maschinenbau, 5. Semester. CATIA V5 und SolidWorks. Englisch C1. Teamplayer. Konstruktionserfahrung aus Werkstudententätigkeit.',
  );

  it('rates the job that fits the CV much higher', () => {
    const a = matchJob(cad, cv, corpus);
    const b = matchJob(sales, cv, corpus);
    expect(a.score).toBeGreaterThanOrEqual(70);
    expect(a.level).toBe('high');
    expect(b.score).toBeLessThan(25);
    expect(a.matched).toEqual(expect.arrayContaining(['CATIA', 'SolidWorks', 'Englisch']));
    expect(b.missing).toEqual(expect.arrayContaining(['Führerschein', 'Französisch']));
  });

  it('lists profile requirements first', () => {
    const r = matchJob(cad, cv, corpus);
    expect(r.keywords.slice(0, 5)).toEqual(
      expect.arrayContaining(['CATIA', 'SolidWorks', 'Maschinenbau', 'Englisch']),
    );
  });

  it('gives keywords but no score without a CV', () => {
    const r = matchJob(sales, null, corpus);
    expect(r.score).toBeNull();
    expect(r.keywords).toEqual(expect.arrayContaining(['Führerschein', 'Ausbildung']));
  });

  it('levels', () => {
    expect([levelOf(85), levelOf(50), levelOf(30), levelOf(5)]).toEqual([
      'high',
      'good',
      'partial',
      'low',
    ]);
  });
});

describe('matchAll on a real XING export', () => {
  const data = jobs.map((j, i) => ({
    ...job({ url: `${j.url}#${i}`, company: j.company, description: j.description }),
    ...splitSections(j.description),
    title: i === 0 ? 'Recruiter (m/w/d)' : 'Initiativbewerbung',
  }));

  it('only uses nouns as free keywords in German ads (no verbs like "finden")', () => {
    for (const r of matchAll(data, '').values()) {
      for (const k of r.keywords) expect(k).toMatch(/^\p{Lu}/u);
    }
  });

  it('puts the recruiting job first for a recruiting CV', () => {
    const res = matchAll(
      data,
      'Personalwesen, Recruiting, Active Sourcing, Studium BWL, MS Office, Englisch, Kommunikation',
    );
    const ranked = [...res.entries()].sort((a, b) => (b[1].score ?? 0) - (a[1].score ?? 0));
    expect(ranked[0]![0]).toContain('recruiter');
  });
});

describe('CV files', () => {
  it('recognizes the file types', () => {
    expect(cvFileKind('Lebenslauf.PDF')).toBe('pdf');
    expect(cvFileKind('cv.docx')).toBe('docx');
    expect(cvFileKind('skills.txt')).toBe('text');
    expect(cvFileKind('cv.doc')).toBeNull();
  });

  it('reads the paragraphs of a .docx file', () => {
    const xml =
      '<?xml version="1.0"?><w:document xmlns:w="x"><w:body>' +
      '<w:p><w:r><w:t>Max Muster</w:t></w:r></w:p>' +
      '<w:p><w:r><w:t xml:space="preserve">Python </w:t></w:r><w:r><w:t>&amp; SQL</w:t></w:r></w:p>' +
      '<w:p><w:r><w:t>A</w:t><w:tab/><w:t>B</w:t><w:br/><w:t>C</w:t></w:r></w:p>' +
      '</w:body></w:document>';
    const bytes = zipSync({
      'word/document.xml': strToU8(xml),
      '[Content_Types].xml': strToU8(''),
    });
    expect(docxText(bytes)).toBe('Max Muster\nPython & SQL\nA B\nC');
  });
});

describe('must-have vs nice-to-have', () => {
  const html = (body: string): Element =>
    new JSDOM(`<div id="d">${body}</div>`).window.document.getElementById('d')!;
  const sections = splitSections(
    html(
      '<h3>Ihr Profil</h3><ul><li>Studium Maschinenbau zwingend erforderlich</li><li>Sehr gute Englischkenntnisse</li></ul>' +
        '<p>Wünschenswert:</p><ul><li>Erfahrung mit CATIA</li><li>Französisch</li></ul>' +
        '<p>Kein Lebenslauf erforderlich.</p><h3>Wir bieten</h3><p>Obst</p>',
    ),
  );
  const ad = job({ title: 'Praktikum Konstruktion', url: 'https://example.com/a', ...sections });

  it('reads the importance of each requirement line', () => {
    expect(requirementLines(ad).map((l) => l.importance)).toEqual([
      'must',
      'normal',
      'nice',
      'nice',
      'nice',
    ]);
  });

  it('marks required and optional keywords and weighs them', () => {
    const fits = matchAll([ad], 'Maschinenbau Studium, Englisch').get(ad.url)!;
    const extras = matchAll([ad], 'CATIA, Französisch, Englisch').get(ad.url)!;
    expect(fits.required).toEqual(['Maschinenbau', 'Studium']);
    expect(fits.optional).toEqual(expect.arrayContaining(['CATIA', 'Französisch']));
    expect(fits.keywords).not.toContain('Lebenslauf');
    // Having the must-haves beats having only the nice-to-haves.
    expect(fits.score!).toBeGreaterThan(extras.score! + 25);
  });

  it('ends a nice-to-have block at the end of the profile (tasks are not optional)', () => {
    const lines = requirementLines(
      job({
        profile: '• Studium\n\nWünschenswert:\n\n• SolidWorks',
        tasks: '• Konstruktion in CATIA',
      }),
    );
    expect(lines.map((l) => [l.text, l.importance])).toEqual([
      ['• Studium', 'normal'],
      ['• SolidWorks', 'nice'],
      ['• Konstruktion in CATIA', 'normal'],
    ]);
  });

  it('treats "nicht erforderlich" / "no … required" as optional', () => {
    const lines = requirementLines(
      job({ profile: 'Keine Berufserfahrung erforderlich\nNo prior experience required' }),
    );
    expect(lines.map((l) => l.importance)).toEqual(['nice', 'nice']);
  });
});

describe('English CV ↔ German ad', () => {
  const ad = job({
    title: 'Praktikant Entwicklung',
    url: 'https://example.com/b',
    profile:
      '• Erfahrung in der Konstruktion\n• Kenntnisse in Simulation und Messtechnik\n• Englischkenntnisse',
    tasks: '• Mitarbeit an Entwicklungsprojekten\n• Prüfung von Bauteilen',
  });

  it('matches German keywords with their English counterparts', () => {
    const r = matchAll(
      [ad],
      'Mechanical engineering student. Experience in mechanical design, development of test rigs, simulations, testing of components. Fluent English.',
    ).get(ad.url)!;
    expect(r.matched).toEqual(
      expect.arrayContaining(['Englisch', 'Konstruktion', 'Simulation', 'Bauteilen']),
    );
    expect(r.score!).toBeGreaterThanOrEqual(60);
  });
});
