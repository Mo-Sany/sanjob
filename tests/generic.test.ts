import { detectBlock } from '../src/extract/block';
import { extractDetail } from '../src/extract/detail';
import { cardFromPicked, detectCardGroups } from '../src/extract/generic';
import { extractListing } from '../src/extract/listing';
import { presetForUrl } from '../src/presets/presets';
import { loadFixture } from './helpers/fixture';

const url = 'https://karriere.beispielwerke.de/karriere';

describe('generic mode (no preset)', () => {
  it('auto-detects the repeating job cards, not the menu', () => {
    const doc = loadFixture('generic/jobs-list.synthetic.html', url);
    const [best] = detectCardGroups(doc);
    expect(best?.cards).toHaveLength(4);
    expect(best?.selector).toBe('#openings > div.opening.card');
    expect(doc.querySelectorAll(best!.selector)).toHaveLength(4);
  });

  it('collects links via auto-detection and finds rel="next"', () => {
    const doc = loadFixture('generic/jobs-list.synthetic.html', url);
    const res = extractListing({ doc, pageUrl: url, preset: null });
    expect(res.links.map((l) => l.url)).toEqual([
      'https://karriere.beispielwerke.de/karriere/stellen/101',
      'https://karriere.beispielwerke.de/karriere/stellen/102',
      'https://karriere.beispielwerke.de/karriere/stellen/103?utm_source=site',
      'https://karriere.beispielwerke.de/karriere/stellen/104',
    ]);
    expect(res.links[0]?.hints?.title).toBe('Industriemechaniker (m/w/d)');
    expect(res.nextUrl).toBe('https://karriere.beispielwerke.de/karriere?page=2');
  });

  it('uses a picked card selector', () => {
    const doc = loadFixture('generic/jobs-list.synthetic.html', url);
    const clicked = doc.querySelectorAll('#openings p')[1]!;
    const picked = cardFromPicked(clicked);
    expect(picked?.count).toBe(4);
    const res = extractListing({
      doc,
      pageUrl: url,
      preset: null,
      generic: { cardSelector: picked!.selector },
    });
    expect(res.links).toHaveLength(4);
  });

  it('extracts a generic detail page from h1 + description container', () => {
    const doc = loadFixture('stepstone/detail.synthetic.html', 'https://jobs.example.org/stelle/1');
    doc.querySelector('script[type="application/ld+json"]')?.remove();
    doc.querySelector('[data-at="job-ad-content"]')!.setAttribute('class', 'job-description');
    doc.querySelector('[data-at="metadata-location"]')!.remove();
    const res = extractDetail({ doc, pageUrl: 'https://jobs.example.org/stelle/1', preset: null });
    expect(res.job?.title).toBe('Elektroniker (m/w/d)');
    expect(res.job?.company).toBe('');
    expect(res.job?.description).toContain('Ihre Aufgaben');
  });
});

describe('block detection (CAPTCHA / login / block page)', () => {
  it('detects a CAPTCHA interstitial and returns no data', () => {
    const doc = loadFixture('generic/captcha.synthetic.html', 'https://de.indeed.com/viewjob?jk=1');
    const res = extractDetail({ doc, pageUrl: 'https://de.indeed.com/viewjob?jk=1', preset: null });
    expect(res.job).toBeNull();
    expect(res.block?.kind).toBe('captcha');
    const listing = extractListing({
      doc,
      pageUrl: 'https://de.indeed.com/jobs?q=x',
      preset: null,
    });
    expect(listing.block?.kind).toBe('captcha');
    expect(listing.links).toEqual([]);
  });

  it('does not stop on a normal job page that mentions captcha or login', () => {
    const doc = loadFixture('stepstone/detail.synthetic.html', 'https://www.stepstone.de/x');
    doc
      .querySelector('[data-at="job-ad-content"]')!
      .append('Erfahrung mit Login-Systemen und CAPTCHA-Diensten.');
    expect(detectBlock(doc, 'https://www.stepstone.de/x', undefined, true)).toBeNull();
  });

  it('detects an access-denied page', () => {
    const doc = loadFixture('generic/captcha.synthetic.html', 'https://example.com/');
    doc.title = '403 Forbidden';
    doc.body.innerHTML = '<h1>Access denied</h1>';
    expect(detectBlock(doc, 'https://example.com/', undefined, false)?.kind).toBe('blocked');
  });

  it('detects a generic login form', () => {
    const doc = loadFixture('generic/captcha.synthetic.html', 'https://example.com/login');
    doc.title = 'Sign in';
    doc.body.innerHTML = '<form><input type="email"><input type="password"></form>';
    expect(detectBlock(doc, 'https://example.com/login', undefined, false)?.kind).toBe('login');
  });
});

describe('block detection ignores result-card hints', () => {
  it('stops on a CAPTCHA page even when the card provided company/location', () => {
    const pageUrl = 'https://de.indeed.com/viewjob?jk=bbbb111122223333';
    const doc = loadFixture('generic/captcha.synthetic.html', pageUrl);
    const res = extractDetail({
      doc,
      pageUrl,
      preset: presetForUrl(pageUrl),
      hints: { title: 'Mechatroniker', company: 'Beta AG', location: 'Hamburg' },
    });
    expect(res.job).toBeNull();
    expect(res.block?.kind).toBe('captcha');
  });

  it('still fills missing fields from hints on a real job page', () => {
    const pageUrl = 'https://de.indeed.com/viewjob?jk=24f47c3c796d9b1e';
    const doc = loadFixture('indeed/homepage-feed.html', pageUrl);
    const res = extractDetail({
      doc,
      pageUrl,
      preset: presetForUrl(pageUrl),
      hints: { datePosted: '2026-10-01' },
    });
    expect(res.job?.datePosted).toBe('2026-10-01');
  });
});
