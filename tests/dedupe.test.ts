import 'fake-indexeddb/auto';
import { Repo, SanjobDB } from '../src/db/db';
import type { JobRecord } from '../src/shared/types';

let n = 0;
const fresh = (): Repo => new Repo(new SanjobDB(`test-${n++}`));

const job = (url: string, runId = 'r1'): Omit<JobRecord, 'key' | 'id'> => ({
  title: 'T',
  company: 'C',
  location: '',
  datePosted: '',
  salary: '',
  contractType: '',
  url,
  description: 'D',
  site: 'generic',
  runId,
  collectedAt: Date.now(),
});

describe('dedupe across runs', () => {
  it('skips links already queued in the same run (incl. URL variants)', async () => {
    const repo = fresh();
    const res = await repo.enqueue('r1', [
      { url: 'https://de.indeed.com/viewjob?jk=a' },
      { url: 'https://de.indeed.com/rc/clk?jk=a&from=serp' },
      { url: 'https://de.indeed.com/viewjob?jk=b' },
    ]);
    expect(res).toEqual({ added: 2, duplicates: 0, repeated: 1 });
    const again = await repo.enqueue('r1', [{ url: 'https://de.indeed.com/viewjob?jk=b' }]);
    expect(again).toEqual({ added: 0, duplicates: 0, repeated: 1 });
  });

  it('skips URLs collected in an earlier run, until the history is cleared', async () => {
    const repo = fresh();
    expect(await repo.addJob(job('https://example.com/jobs/1?utm_source=x'))).toBe(true);
    expect(await repo.isKnown('https://example.com/jobs/1')).toBe(true);

    const r2 = await repo.enqueue('r2', [
      { url: 'https://www.example.com/jobs/1/' },
      { url: 'https://example.com/jobs/2' },
    ]);
    expect(r2).toEqual({ added: 1, duplicates: 1, repeated: 0 });

    const again = await repo.enqueue('r2', [{ url: 'https://example.com/jobs/1' }]);
    expect(again).toEqual({ added: 0, duplicates: 0, repeated: 1 });
    expect((await repo.queueCounts('r2')).skipped).toBe(1);
    expect((await repo.nextPending('r2'))?.url).toBe('https://example.com/jobs/2');

    await repo.clearHistory();
    const r3 = await repo.enqueue('r3', [{ url: 'https://example.com/jobs/1' }]);
    expect(r3.added).toBe(1);
  });

  it('never stores the same job URL twice', async () => {
    const repo = fresh();
    expect(await repo.addJob(job('https://example.com/jobs/1'))).toBe(true);
    expect(await repo.addJob(job('https://example.com/jobs/1#top', 'r2'))).toBe(false);
    expect(await repo.allJobs()).toHaveLength(1);
  });

  it('keeps the queue order and resumes from the next pending item', async () => {
    const repo = fresh();
    await repo.enqueue('r1', [
      { url: 'https://e.com/1' },
      { url: 'https://e.com/2' },
      { url: 'https://e.com/3' },
    ]);
    const first = await repo.nextPending('r1');
    expect(first?.url).toBe('https://e.com/1');
    await repo.markQueue(first!.id!, 'done');
    const second = await repo.nextPending('r1');
    await repo.markQueue(second!.id!, 'error', 'boom');
    expect((await repo.nextPending('r1'))?.url).toBe('https://e.com/3');
    expect(await repo.queueCounts('r1')).toEqual({
      pending: 1,
      done: 1,
      error: 1,
      skipped: 0,
      total: 3,
    });
  });

  it('deletes rows', async () => {
    const repo = fresh();
    await repo.addJob(job('https://e.com/1'));
    await repo.addJob(job('https://e.com/2'));
    const [first] = await repo.allJobs();
    await repo.deleteJobs([first!.id!]);
    expect((await repo.allJobs()).map((j) => j.url)).toEqual(['https://e.com/2']);
  });
});
