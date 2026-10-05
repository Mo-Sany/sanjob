import { extractDetail } from '../../src/extract/detail';
import { extractListing } from '../../src/extract/listing';
import { presetForUrl } from '../../src/presets/presets';
import { loadFixture } from '../helpers/fixture';

const now = new Date(2026, 9, 5, 12);

describe('XING preset – fixtures/xing/jobseeker-criteria.html (real saved page)', () => {
  const url = 'https://www.xing.com/jobseeker-criteria';
  const doc = loadFixture('xing/jobseeker-criteria.html', url);
  const preset = presetForUrl(url);

  it('finds no jobs on the preferences page and does not treat navigation links as jobs', () => {
    expect(preset?.id).toBe('xing');
    const res = extractListing({ doc, pageUrl: url, preset, now });
    expect(res.links).toEqual([]);
    expect(res.nextUrl).toBeNull();
    expect(res.block).toBeNull();
  });

  it('is not a job detail page', () => {
    expect(extractDetail({ doc, pageUrl: url, preset, now }).job).toBeNull();
  });
});

describe('XING preset – synthetic fixtures', () => {
  it('collects job links by URL pattern and the next page', () => {
    const url = 'https://www.xing.com/jobs/search?keywords=Elektroniker&location=Hamburg';
    const res = extractListing({
      doc: loadFixture('xing/search.synthetic.html', url),
      pageUrl: url,
      preset: presetForUrl(url),
      now,
    });
    expect(res.links.map((l) => l.url)).toEqual([
      'https://www.xing.com/jobs/hamburg-elektroniker-m-w-d-123456789',
      'https://www.xing.com/jobs/hamburg-servicetechniker-elektrotechnik-987654321',
    ]);
    expect(res.links[0]?.hints).toMatchObject({
      title: 'Elektroniker (m/w/d)',
      company: 'Nord Energie GmbH',
    });
    expect(res.nextUrl).toBe(
      'https://www.xing.com/jobs/search?keywords=Elektroniker&location=Hamburg&page=2',
    );
  });

  it('reads JSON-LD inside @graph and the page description', () => {
    const url = 'https://www.xing.com/jobs/hamburg-elektroniker-m-w-d-123456789';
    const job = extractDetail({
      doc: loadFixture('xing/detail.synthetic.html', url),
      pageUrl: url,
      preset: presetForUrl(url),
      now,
    }).job!;
    expect(job).toMatchObject({
      title: 'Elektroniker (m/w/d)',
      company: 'Nord Energie GmbH',
      location: 'Hamburg, DE',
      datePosted: '2026-10-04',
      salary: '48.000 € – 55.000 € (XING-Schätzung)',
      contractType: 'Full-time, Part-time',
    });
    expect(job.description).toBe(
      'Nord Energie betreibt Umspannwerke in ganz Norddeutschland.\n\nDeine Aufgaben\nInbetriebnahme von Schaltanlagen\nFehlersuche und Dokumentation',
    );
  });
});
