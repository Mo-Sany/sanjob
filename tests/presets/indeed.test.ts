import { extractDetail } from '../../src/extract/detail';
import { extractListing } from '../../src/extract/listing';
import { presetForUrl } from '../../src/presets/presets';
import { loadFixture } from '../helpers/fixture';

const now = new Date(2026, 9, 5, 12);

describe('Indeed preset – fixtures/indeed/homepage-feed.html (real saved page)', () => {
  const url = 'https://de.indeed.com/?from=gnav-homepage';
  const doc = loadFixture('indeed/homepage-feed.html', url);
  const preset = presetForUrl(url);

  it('is selected for de.indeed.com', () => {
    expect(preset?.id).toBe('indeed');
  });

  it('collects all 12 job cards as stable /viewjob?jk= links with card hints', () => {
    const res = extractListing({ doc, pageUrl: url, preset, now });
    expect(res.block).toBeNull();
    expect(res.links).toHaveLength(12);
    expect(
      res.links.every((l) => /^https:\/\/de\.indeed\.com\/viewjob\?jk=[0-9a-f]{16}$/.test(l.url)),
    ).toBe(true);
    expect(res.links[0]).toEqual({
      url: 'https://de.indeed.com/viewjob?jk=24f47c3c796d9b1e',
      hints: {
        title: 'Lagerhelfer / Verpacker (m/w/d) - Cloppenburg',
        company: 'Amazon Logistik',
        location: '26122 Oldenburg',
        salary: 'Ab 16,75 € pro Stunde',
      },
    });
    // The home feed has no pagination.
    expect(res.nextUrl).toBeNull();
  });

  it('extracts the opened job (embedded job view) with all available fields', () => {
    const res = extractDetail({
      doc,
      pageUrl: url,
      jobUrl: 'https://de.indeed.com/viewjob?jk=24f47c3c796d9b1e',
      preset,
      now,
    });
    expect(res.block).toBeNull();
    const job = res.job!;
    expect(job.title).toBe('Lagerhelfer / Verpacker (m/w/d) - Cloppenburg');
    expect(job.company).toBe('Amazon Logistik');
    expect(job.location).toBe('Bleicherstraße 11, 26122 Oldenburg');
    expect(job.salary).toBe('Ab 16,75 € pro Stunde');
    expect(job.contractType).toBe('Teilzeit, Vollzeit');
    expect(job.datePosted).toBe('');
    expect(job.url).toBe('https://de.indeed.com/viewjob?jk=24f47c3c796d9b1e');
    expect(job.description).toMatch(/^Bewirb dich jetzt als Versand-\/ Lagermitarbeiter/);
    expect(job.description).toContain('Garantierte Lohnanpassung nach 12 Monaten');
    expect(job.description).not.toContain('@layer');
    expect(job.description.length).toBeGreaterThan(1000);
  });
});

describe('Indeed preset – fixtures/indeed/search.synthetic.html', () => {
  const url = 'https://de.indeed.com/jobs?q=Elektroniker&l=Hamburg';
  const doc = loadFixture('indeed/search.synthetic.html', url);
  const preset = presetForUrl(url);

  it('follows the next-page link and normalizes card dates', () => {
    const res = extractListing({ doc, pageUrl: url, preset, now });
    expect(res.links.map((l) => l.url)).toEqual([
      'https://de.indeed.com/viewjob?jk=aaaa111122223333',
      'https://de.indeed.com/viewjob?jk=bbbb111122223333',
    ]);
    expect(res.links[0]?.hints?.datePosted).toBe('2026-10-02');
    expect(res.nextUrl).toBe('https://de.indeed.com/jobs?q=Elektroniker&l=Hamburg&start=10');
    expect(res.nextIsClick).toBe(false);
  });
});
