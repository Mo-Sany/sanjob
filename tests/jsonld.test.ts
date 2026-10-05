import { JSDOM } from 'jsdom';
import { findJobPostings, jobFromJsonLd } from '../src/extract/jsonld';

const doc = (scripts: string[]): Document =>
  new JSDOM(
    `<html><head>${scripts.map((s) => `<script type="application/ld+json">${s}</script>`).join('')}</head><body></body></html>`,
  ).window.document;

describe('JSON-LD JobPosting', () => {
  it('finds postings inside @graph and arrays, ignores other types', () => {
    const d = doc([
      '{"@type":"WebSite","name":"x"}',
      '[{"@type":"Organization"},{"@type":"JobPosting","title":"A"}]',
      '{"@graph":[{"@type":["JobPosting"],"title":"B"}]}',
      'not json',
    ]);
    expect(findJobPostings(d).map((j) => j['title'])).toEqual(['A', 'B']);
  });

  it('maps all columns', () => {
    const d = doc([
      JSON.stringify({
        '@type': 'JobPosting',
        title: 'Elektroniker (m/w/d)',
        datePosted: '2026-10-01',
        employmentType: ['FULL_TIME', 'PART_TIME'],
        hiringOrganization: { '@type': 'Organization', name: 'Müller & Söhne GmbH' },
        jobLocation: [
          { address: { addressLocality: 'Köln', postalCode: '50667', addressCountry: 'DE' } },
          { address: { addressLocality: 'Bonn' } },
        ],
        jobLocationType: 'TELECOMMUTE',
        baseSalary: {
          currency: 'EUR',
          value: { minValue: 40000, maxValue: 50000, unitText: 'YEAR' },
        },
        description: '<p>Hallo <b>Welt</b></p><ul><li>Eins</li><li>Zwei</li></ul>',
      }),
    ]);
    const job = jobFromJsonLd(findJobPostings(d)[0]!, d);
    expect(job).toEqual({
      title: 'Elektroniker (m/w/d)',
      company: 'Müller & Söhne GmbH',
      location: '50667 Köln, DE; Bonn; Remote',
      datePosted: '2026-10-01',
      salary: '40.000–50.000 EUR / YEAR',
      contractType: 'Full-time, Part-time',
      description: 'Hallo Welt\n\nEins\nZwei',
    });
  });

  it('leaves missing values empty', () => {
    const d = doc(['{"@type":"JobPosting","title":"Only title"}']);
    const job = jobFromJsonLd(findJobPostings(d)[0]!, d);
    expect(job.company).toBe('');
    expect(job.salary).toBe('');
    expect(job.location).toBe('');
  });
});
