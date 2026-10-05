import { extractDetail } from '../../src/extract/detail';
import { extractListing } from '../../src/extract/listing';
import { presetForUrl } from '../../src/presets/presets';
import { loadFixture } from '../helpers/fixture';

const now = new Date(2026, 9, 5, 12);

describe('StepStone preset – synthetic fixtures (no real saved page provided yet)', () => {
  it('collects result links, card hints and the next page', () => {
    const url = 'https://www.stepstone.de/jobs/elektroniker/in-hamburg';
    const preset = presetForUrl(url);
    expect(preset?.id).toBe('stepstone');
    const res = extractListing({
      doc: loadFixture('stepstone/search.synthetic.html', url),
      pageUrl: url,
      preset,
      now,
    });
    expect(res.links.map((l) => l.url)).toEqual([
      'https://www.stepstone.de/stellenangebote--Elektroniker-m-w-d-Hamburg-Muster-GmbH--12345678-inline.html',
      'https://www.stepstone.de/stellenangebote--Mechatroniker-Hamburg-Beispiel-AG--87654321-inline.html',
      'https://www.stepstone.de/stellenangebote--Werkstudent-Automatisierung-Hamburg-Tech-SE--11223344-inline.html',
    ]);
    expect(res.links[0]?.hints).toEqual({
      title: 'Elektroniker (m/w/d)',
      company: 'Muster GmbH',
      location: 'Hamburg',
      salary: '45.000 – 52.000 €/Jahr',
      datePosted: '2026-10-03',
    });
    expect(res.links[1]?.hints?.datePosted).toBe('2026-10-05');
    expect(res.nextUrl).toBe('https://www.stepstone.de/jobs/elektroniker/in-hamburg?page=2');
  });

  it('prefers JSON-LD fields and takes the description text from the page', () => {
    const url =
      'https://www.stepstone.de/stellenangebote--Elektroniker-m-w-d-Hamburg-Muster-GmbH--12345678-inline.html';
    const res = extractDetail({
      doc: loadFixture('stepstone/detail.synthetic.html', url),
      pageUrl: url,
      preset: presetForUrl(url),
      now,
    });
    expect(res.source).toBe('mixed');
    expect(res.job).toMatchObject({
      title: 'Elektroniker (m/w/d)',
      company: 'Muster GmbH',
      location: '20095 Hamburg, DE',
      datePosted: '2026-10-03',
      salary: '45.000–52.000 EUR / YEAR',
      contractType: 'Full-time',
    });
    expect(res.job?.description).toMatch(/^Über uns\n\nDie Muster GmbH/);
    expect(res.job?.description).toContain(
      'Wartung und Instandsetzung elektrischer Anlagen\nPrüfung nach DGUV V3',
    );
  });

  it('falls back to selectors when there is no JSON-LD', () => {
    const url = 'https://www.stepstone.de/stellenangebote--x--1-inline.html';
    const doc = loadFixture('stepstone/detail.synthetic.html', url);
    doc.querySelector('script[type="application/ld+json"]')?.remove();
    const job = extractDetail({ doc, pageUrl: url, preset: presetForUrl(url), now }).job!;
    expect(job).toMatchObject({
      company: 'Muster GmbH',
      location: 'Hamburg',
      contractType: 'Feste Anstellung, Vollzeit',
      datePosted: '2026-10-03',
      salary: '',
    });
  });
});
