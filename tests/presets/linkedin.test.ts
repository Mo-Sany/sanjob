import { analyzePage } from '../../src/extract/analyze';
import { extractDetail } from '../../src/extract/detail';
import { extractListing } from '../../src/extract/listing';
import { presetList } from '../../src/extract/lists';
import { presetForUrl } from '../../src/presets/presets';
import { loadFixture } from '../helpers/fixture';

const now = new Date(2026, 9, 5, 12);

describe('LinkedIn preset – fixtures/linkedin/jobs-home.html (real saved page)', () => {
  const url = 'https://www.linkedin.com/jobs/';
  const doc = loadFixture('linkedin/jobs-home.html', url);
  const preset = presetForUrl(url);

  it('is selected for www.linkedin.com', () => {
    expect(preset?.id).toBe('linkedin');
  });

  it('collects the 6 job cards as /jobs/view/<id>/ links', () => {
    const res = extractListing({ doc, pageUrl: url, preset, now });
    expect(res.block).toBeNull();
    expect(res.links.map((l) => l.url)).toEqual([
      'https://www.linkedin.com/jobs/view/4441624915/',
      'https://www.linkedin.com/jobs/view/4472574626/',
      'https://www.linkedin.com/jobs/view/4462295045/',
      'https://www.linkedin.com/jobs/view/4406001553/',
      'https://www.linkedin.com/jobs/view/4468764153/',
      'https://www.linkedin.com/jobs/view/4464799100/',
    ]);
    expect(res.links[0]?.hints?.title).toBe('Stage Elektromechanieker');
    expect(res.links[1]?.hints).toEqual({
      title: 'Placement Student - Electronic System Engineering',
      company: 'Cummins Europe',
      datePosted: '2026-10-02',
    });
    expect(res.nextUrl).toBeNull();
  });

  it('does not mistake the jobs home for a job detail page', () => {
    const res = extractDetail({ doc, pageUrl: url, preset, now });
    expect(res.job).toBeNull();
    expect(res.block).toBeNull();
  });
});

describe('LinkedIn preset – fixtures/linkedin/detail.synthetic.html', () => {
  const url = 'https://www.linkedin.com/jobs/view/4462295045/';
  const doc = loadFixture('linkedin/detail.synthetic.html', url);
  const preset = presetForUrl(url);

  it('extracts the unified top card and description', () => {
    const job = extractDetail({ doc, pageUrl: url, preset, now }).job!;
    expect(job).toMatchObject({
      title: 'Automation Engineer',
      company: 'Contoso Automation',
      location: 'Munich, Bavaria, Germany',
      datePosted: '2026-10-02',
      salary: '€60K/yr - €75K/yr',
      contractType: 'Full-time',
      url: 'https://www.linkedin.com/jobs/view/4462295045/',
    });
    expect(job.description).toMatch(
      /^About the job\n\nContoso builds automation lines for the automotive industry\.\n\nYour tasks\n\nPLC programming \(Siemens TIA Portal\)\nCommissioning at customer sites\nRequirements\n/,
    );
  });

  it('detects the LinkedIn login wall by URL', () => {
    const wall = loadFixture(
      'linkedin/detail.synthetic.html',
      'https://www.linkedin.com/authwall?trk=x',
    );
    const res = extractDetail({
      doc: wall,
      pageUrl: 'https://www.linkedin.com/authwall?trk=x',
      preset,
      now,
    });
    expect(res.block?.kind).toBe('login');
  });
});

describe('LinkedIn preset – fixtures/linkedin/search-results.html (new layout, real saved page)', () => {
  const url =
    'https://www.linkedin.com/jobs/search-results/?currentJobId=4406001553&showHowYouFit=true';
  const doc = loadFixture('linkedin/search-results.html', url);
  const preset = presetForUrl(url);

  it('collects all 25 cards of the left list (cards have no links, only componentkey)', () => {
    const res = extractListing({ doc, pageUrl: url, preset, now });
    expect(res.block).toBeNull();
    expect(res.links).toHaveLength(25);
    expect(
      res.links.every((l) => /^https:\/\/www\.linkedin\.com\/jobs\/view\/\d+\/$/.test(l.url)),
    ).toBe(true);
    expect(res.links[0]).toEqual({
      url: 'https://www.linkedin.com/jobs/view/4406001553/',
      hints: {
        title: 'Praxissemester Assembly Door Surrounding (m/w/d)',
        company: 'Airbus Aircraft',
        location: 'Varel (Hybrid)',
        datePosted: '2026-09-28',
      },
    });
    expect(res.links.map((l) => l.url)).toContain('https://www.linkedin.com/jobs/view/4468764153/');
  });

  it('pages by clicking "next" (the new page ignores ?start=)', () => {
    const res = extractListing({ doc, pageUrl: url, preset, now });
    expect(res.nextIsClick).toBe(true);
    expect(res.nextUrl).toBe(url);
  });

  it('reads 32 results on 2 pages', () => {
    const a = analyzePage({ doc, url, preset });
    expect(a.itemsOnPage).toBe(25);
    expect(a.totalResults).toBe(32);
    expect(a.totalPages).toBe(2);
  });

  it('finds the whole list as one block for the hover preview', () => {
    const list = presetList({ doc, url, preset });
    expect(list?.items).toHaveLength(25);
    expect(
      list?.container.contains(
        doc.querySelector('[componentkey="JobDetails_PremiumApplicantInsights_4406001553"]'),
      ),
    ).toBe(false);
  });
});
