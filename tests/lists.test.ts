import { analyzePage } from '../src/extract/analyze';
import { listAt, presetList } from '../src/extract/lists';
import { presetForUrl } from '../src/presets/presets';
import { hoverLabel } from '../src/content/hover';
import { loadFixture } from './helpers/fixture';

const ctxFor = (fixture: string, url: string) => {
  const doc = loadFixture(fixture, url);
  return { doc, url, preset: presetForUrl(url) };
};

describe('whole-list detection on the supported sites (hover preview / picker)', () => {
  it.each([
    ['Indeed', 'indeed/homepage-feed.html', 'https://de.indeed.com/', 12],
    ['LinkedIn', 'linkedin/jobs-home.html', 'https://www.linkedin.com/jobs/', 6],
    ['XING', 'xing/search.synthetic.html', 'https://www.xing.com/jobs/search?keywords=x', 2],
    ['StepStone', 'stepstone/search.synthetic.html', 'https://www.stepstone.de/jobs/x', 3],
  ])('%s: hovering inside any card highlights the whole list', (_site, fixture, url, count) => {
    const ctx = ctxFor(fixture, url);
    const page = presetList(ctx);
    expect(page?.items).toHaveLength(count);
    expect(page?.smart).toBe(true);
    // Hover deep inside the last card.
    const last = page!.items.at(-1)!;
    const target = last.querySelector('span, p, h2, h3, a') ?? last;
    expect(listAt(target, ctx, page)?.items).toHaveLength(count);
  });

  it('LinkedIn: finds all 6 cards although they sit in two blocks (heuristic only finds 3)', () => {
    const ctx = ctxFor('linkedin/jobs-home.html', 'https://www.linkedin.com/jobs/');
    const page = presetList(ctx)!;
    const firstBlock = page.items[0]!;
    expect(listAt(firstBlock, ctx, page)?.items).toHaveLength(6);
  });

  it('falls back to the heuristic on other sites', () => {
    const url = 'https://karriere.example.org/';
    const ctx = ctxFor('generic/jobs-list.synthetic.html', url);
    expect(presetList(ctx)).toBeNull();
    const target = ctx.doc.querySelector('#openings p')!;
    expect(listAt(target, ctx)?.items).toHaveLength(4);
  });

  it('labels the list with the full or approximate count', () => {
    expect(hoverLabel(25, 360, 'de')).toBe('Liste mit 25 Jobs · ca. 360 insgesamt');
    expect(hoverLabel(25, 1360, 'en')).toBe('List with 25 jobs · about 1,360 in total');
    expect(hoverLabel(12, null, 'en')).toBe('List with 12 jobs on this page');
  });
});

describe('analysis counts filtered jobs', () => {
  it('counts titles the filter will skip', () => {
    const url = 'https://www.stepstone.de/jobs/x';
    const doc = loadFixture('stepstone/search.synthetic.html', url);
    const a = analyzePage({ doc, url, preset: presetForUrl(url), exclude: ['Werkstudent'] });
    expect(a.excludedOnPage).toBe(1);
  });
});
