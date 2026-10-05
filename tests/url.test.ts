import { canonicalJobUrl, normalizeUrl } from '../src/shared/url';

describe('canonicalJobUrl', () => {
  it('maps Indeed redirect/tracking URLs to /viewjob?jk=', () => {
    expect(canonicalJobUrl('https://de.indeed.com/rc/clk?jk=abc123&from=serp&vjs=3')).toBe(
      'https://de.indeed.com/viewjob?jk=abc123',
    );
    expect(canonicalJobUrl('https://de.indeed.com/viewjob?jk=abc123&tk=xyz')).toBe(
      'https://de.indeed.com/viewjob?jk=abc123',
    );
  });

  it('maps LinkedIn variants to /jobs/view/<id>/', () => {
    expect(
      canonicalJobUrl(
        'https://www.linkedin.com/jobs/view/automation-engineer-at-x-4441624915?trk=abc',
      ),
    ).toBe('https://www.linkedin.com/jobs/view/4441624915/');
    expect(
      canonicalJobUrl(
        'https://www.linkedin.com/jobs/search-results/?keywords=x&currentJobId=4472574626&trackingId=1',
      ),
    ).toBe('https://www.linkedin.com/jobs/view/4472574626/');
  });

  it('strips the query on StepStone and XING', () => {
    expect(
      canonicalJobUrl('https://www.stepstone.de/stellenangebote--A--1-inline.html?rltr=1_1'),
    ).toBe('https://www.stepstone.de/stellenangebote--A--1-inline.html');
    expect(canonicalJobUrl('https://www.xing.com/jobs/hamburg-x-123?ijt=jb_18')).toBe(
      'https://www.xing.com/jobs/hamburg-x-123',
    );
  });
});

describe('normalizeUrl (dedupe key)', () => {
  it('treats URL variants of the same job as equal', () => {
    const a = normalizeUrl('http://www.example.com/jobs/1/?utm_source=x&b=2&a=1#apply');
    const b = normalizeUrl('https://example.com/jobs/1?a=1&b=2');
    expect(a).toBe(b);
  });

  it('keeps identifying query parameters', () => {
    expect(normalizeUrl('https://example.com/job?id=1')).not.toBe(
      normalizeUrl('https://example.com/job?id=2'),
    );
  });

  it('dedupes Indeed links with different tracking params', () => {
    expect(normalizeUrl('https://de.indeed.com/rc/clk?jk=abc&from=serp')).toBe(
      normalizeUrl('https://de.indeed.com/viewjob?jk=abc&tk=1'),
    );
  });
});
