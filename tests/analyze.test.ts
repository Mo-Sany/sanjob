import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { badgeFor, doneMessage } from '../src/background/ui';
import { analyzePage, estimateSeconds, parseCount, readTotalResults } from '../src/extract/analyze';
import { detectCardGroups, findListAround } from '../src/extract/generic';
import { presetForUrl } from '../src/presets/presets';
import { STRINGS, formatDuration } from '../src/shared/i18n';
import type { RunState } from '../src/shared/types';
import { loadFixture } from './helpers/fixture';

const analyze = (fixture: string, url: string) =>
  analyzePage({ doc: loadFixture(fixture, url), url, preset: presetForUrl(url) });

describe('page analysis', () => {
  it('Indeed search: preset, items, total and pages', () => {
    const a = analyze('indeed/search.synthetic.html', 'https://de.indeed.com/jobs?q=Elektroniker');
    expect(a).toMatchObject({
      site: 'indeed',
      siteName: 'Indeed',
      isJobList: true,
      itemsOnPage: 2,
      totalResults: 30,
      totalPages: 15,
      confident: true,
    });
    expect(a.links).toContain('https://de.indeed.com/viewjob?jk=aaaa111122223333');
  });

  it('StepStone search: "360 Jobs gefunden"', () => {
    const a = analyze(
      'stepstone/search.synthetic.html',
      'https://www.stepstone.de/jobs/elektroniker',
    );
    expect(a.siteName).toBe('StepStone');
    expect(a.itemsOnPage).toBe(3);
    expect(a.totalResults).toBe(360);
    expect(a.totalPages).toBe(120);
  });

  it('LinkedIn jobs home (real page): cards but no announced total', () => {
    const a = analyze('linkedin/jobs-home.html', 'https://www.linkedin.com/jobs/');
    expect(a.isJobList).toBe(true);
    expect(a.itemsOnPage).toBe(6);
    expect(a.totalPages).toBe(1);
  });

  it('XING preferences page (real page) is not a job list', () => {
    const a = analyze('xing/jobseeker-criteria.html', 'https://www.xing.com/jobseeker-criteria');
    expect(a).toMatchObject({ site: 'xing', isJobList: false, itemsOnPage: 0 });
  });

  it('generic career page', () => {
    const a = analyze(
      'generic/jobs-list.synthetic.html',
      'https://karriere.beispielwerke.de/karriere',
    );
    expect(a).toMatchObject({
      site: 'generic',
      siteName: 'karriere.beispielwerke.de',
      itemsOnPage: 4,
    });
    expect(a.confident).toBe(true);
  });

  it('reads German and English totals', () => {
    expect(parseCount('1.234')).toBe(1234);
    const doc = loadFixture('generic/jobs-list.synthetic.html', 'https://x.de/');
    doc.querySelector('h1, header')?.remove();
    const h = doc.createElement('h2');
    h.textContent = '1–20 von 1.360 Stellenangeboten';
    doc.body.prepend(h);
    expect(readTotalResults(doc, null, 4)).toBe(1360);
    h.textContent = '360 results';
    expect(readTotalResults(doc, null, 4)).toBe(360);
  });

  it('estimates the run time from the delay', () => {
    // 18 result pages + 342 jobs, 4.5 s delay + 3 s load each
    expect(estimateSeconds(18, 342, 4.5)).toBe(2700);
    expect(formatDuration(2700, 'de')).toBe('45 min');
    expect(formatDuration(5400, 'en')).toBe('1 h 30 min');
  });
});

describe('smart list detection (picker)', () => {
  const doc = () =>
    loadFixture('generic/jobs-list.synthetic.html', 'https://karriere.beispielwerke.de/');

  it('hovering text inside a card finds the whole list', () => {
    const d = doc();
    const list = findListAround(d.querySelectorAll('#openings p')[2]!);
    expect(list?.cards).toHaveLength(4);
    expect(list?.parent.id).toBe('openings');
    expect(list?.parent).toBe(detectCardGroups(d, 1)[0]?.parent);
  });

  it('prefers the big card list over a tiny inner list', () => {
    const d = doc();
    // Give every card an inner list of 3 short links (tags) – those are a list too.
    for (const card of Array.from(d.querySelectorAll('#openings > div'))) {
      const ul = d.createElement('ul');
      ul.innerHTML =
        '<li><a href="/t/1">Vollzeit Job</a></li><li><a href="/t/2">Bremen Job</a></li><li><a href="/t/3">Technik Job</a></li>';
      card.append(ul);
    }
    const hovered = d.querySelector('#openings ul li a')!;
    expect(findListAround(hovered)?.parent.id).toBe('openings');
  });

  it('finds nothing on the menu or outside lists', () => {
    const d = doc();
    expect(findListAround(d.querySelector('main > a[rel="next"]')!)).toBeNull();
  });
});

describe('badge and notification', () => {
  const state = (patch: Partial<RunState>): RunState =>
    ({
      status: 'running',
      phase: 'details',
      done: 44,
      errors: 1,
      total: 360,
      ...patch,
    }) as RunState;

  it('shows progress like "45/360"', () => {
    expect(badgeFor(state({})).text).toBe('45/360');
    expect(badgeFor(state({ phase: 'listing', total: 120 })).text).toBe('120');
    expect(badgeFor(state({ status: 'blocked' })).text).toBe('!');
    expect(badgeFor(state({ status: 'done' })).text).toBe('✓');
    expect(badgeFor(null).text).toBe('');
  });

  it('says "Fertig! 312 Jobs gesammelt"', () => {
    expect(doneMessage(312, 'de')).toBe('Fertig! 312 Jobs gesammelt');
    expect(doneMessage(1, 'en')).toBe('Done! 1 job collected');
  });
});

describe('friendly wording', () => {
  const collect = (v: unknown, out: string[] = []): string[] => {
    if (typeof v === 'string') out.push(v);
    else if (v && typeof v === 'object') Object.values(v).forEach((x) => collect(x, out));
    return out;
  };

  it('no user-visible text says Error / Failed / Exception', () => {
    for (const lang of ['en', 'de'] as const) {
      for (const text of collect(STRINGS[lang])) {
        expect(text).not.toMatch(/error|failed|fehler|exception|fehlgeschlagen/i);
      }
    }
  });

  it('the picker and notification texts are friendly too', () => {
    const src = ['src/content/picker.ts', 'src/background/ui.ts']
      .map((p) => readFileSync(resolve(__dirname, '..', p), 'utf8'))
      .join('\n');
    const literals = src.match(/'[^'\n]*'|`[^`\n]*`/g) ?? [];
    // Sentences only (internal keys such as the 'error' status are not shown to users).
    for (const lit of literals.filter((l) => l.includes(' '))) {
      expect(lit).not.toMatch(/\b(error|failed)\b/i);
    }
  });
});
