import { extractDetail } from '../../src/extract/detail';
import { extractListing } from '../../src/extract/listing';
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
