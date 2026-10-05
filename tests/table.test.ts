import { randomDelayMs, sanitizeSettings } from '../src/shared/settings';
import { filterJobs, sortJobs } from '../src/sidepanel/table';
import type { JobRecord } from '../src/shared/types';

const rec = (title: string, company: string, collectedAt: number, datePosted = ''): JobRecord => ({
  title,
  company,
  location: '',
  datePosted,
  salary: '',
  contractType: '',
  url: `https://e.com/${title}`,
  description: '',
  key: title,
  site: 'generic',
  runId: 'r',
  collectedAt,
});

describe('side panel table', () => {
  const jobs = [
    rec('Zimmerer', 'Holz AG', 1, '2026-10-01'),
    rec('Ärztin', 'Klinik', 2),
    rec('Bäcker', 'Brot GmbH', 3, '2026-09-01'),
  ];

  it('filters by all words over all columns (case-insensitive)', () => {
    expect(filterJobs(jobs, 'holz').map((j) => j.title)).toEqual(['Zimmerer']);
    expect(filterJobs(jobs, 'brot bäcker').map((j) => j.title)).toEqual(['Bäcker']);
    expect(filterJobs(jobs, '')).toHaveLength(3);
  });

  it('sorts locale-aware and keeps empty values last', () => {
    expect(sortJobs(jobs, 'title', 'asc').map((j) => j.title)).toEqual([
      'Ärztin',
      'Bäcker',
      'Zimmerer',
    ]);
    expect(sortJobs(jobs, 'datePosted', 'desc').map((j) => j.title)).toEqual([
      'Zimmerer',
      'Bäcker',
      'Ärztin',
    ]);
    expect(sortJobs(jobs, 'collectedAt', 'desc').map((j) => j.collectedAt)).toEqual([3, 2, 1]);
  });
});

describe('settings', () => {
  it('keeps the delay between min and max', () => {
    const s = sanitizeSettings({ delayMinSec: 3, delayMaxSec: 6 });
    expect(randomDelayMs(s, () => 0)).toBe(3000);
    expect(randomDelayMs(s, () => 0.999999)).toBe(6000);
  });

  it('clamps invalid values', () => {
    const s = sanitizeSettings({ delayMinSec: 10, delayMaxSec: 2, maxPages: -5 });
    expect(s.delayMaxSec).toBe(10);
    expect(s.maxPages).toBe(1);
  });
});
