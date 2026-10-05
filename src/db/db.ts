import Dexie, { type Table } from 'dexie';
import type { JobRecord, ListingLink, QueueItem, RunState } from '../shared/types';
import { normalizeUrl } from '../shared/url';

export interface HistoryEntry {
  key: string;
  seenAt: number;
}

interface MetaEntry {
  k: string;
  v: unknown;
}

/** All persistent data lives in IndexedDB (local to this browser profile). */
export class SanjobDB extends Dexie {
  jobs!: Table<JobRecord, number>;
  history!: Table<HistoryEntry, string>;
  queue!: Table<QueueItem, number>;
  meta!: Table<MetaEntry, string>;

  constructor(name = 'sanjob') {
    super(name);
    this.version(1).stores({
      jobs: '++id, &key, runId, collectedAt',
      history: '&key, seenAt',
      queue: '++id, runId, key, [runId+status], [runId+order]',
      meta: '&k',
    });
  }
}

export const db = new SanjobDB();

export class Repo {
  constructor(private readonly d: SanjobDB = db) {}

  // ── run state ──
  async getRun(): Promise<RunState | null> {
    return ((await this.d.meta.get('run'))?.v as RunState | undefined) ?? null;
  }

  async setRun(state: RunState | null): Promise<void> {
    if (state) await this.d.meta.put({ k: 'run', v: state });
    else await this.d.meta.delete('run');
  }

  async getLastRunId(): Promise<string | null> {
    return ((await this.d.meta.get('lastRunId'))?.v as string | undefined) ?? null;
  }

  async setLastRunId(runId: string): Promise<void> {
    await this.d.meta.put({ k: 'lastRunId', v: runId });
  }

  // ── history (dedupe across runs) ──
  async isKnown(key: string): Promise<boolean> {
    return (await this.d.history.get(key)) !== undefined;
  }

  async clearHistory(): Promise<void> {
    await this.d.history.clear();
  }

  async historySize(): Promise<number> {
    return this.d.history.count();
  }

  // ── queue ──
  /**
   * Adds links to the run's queue.
   * - `duplicates`: URL was collected in an earlier run (history) – stored as "skipped".
   * - `repeated`: URL is already queued in this run (e.g. a result page shown twice).
   */
  async enqueue(
    runId: string,
    links: ListingLink[],
  ): Promise<{ added: number; duplicates: number; repeated: number }> {
    return this.d.transaction('rw', this.d.queue, this.d.history, async () => {
      let added = 0;
      let duplicates = 0;
      let repeated = 0;
      let order = await this.d.queue.where('runId').equals(runId).count();
      for (const link of links) {
        const key = normalizeUrl(link.url);
        if ((await this.d.queue.where({ runId, key }).count()) > 0) {
          repeated++;
          continue;
        }
        // Collected in an earlier run: remember it as "skipped" so a page that only repeats
        // known links is recognized as a repeat (pagination stop), but never open it again.
        const known = (await this.d.history.get(key)) !== undefined;
        const item: QueueItem = {
          runId,
          url: link.url,
          key,
          status: known ? 'skipped' : 'pending',
          order: order++,
        };
        if (link.hints) item.hints = link.hints;
        await this.d.queue.add(item);
        if (known) duplicates++;
        else added++;
      }
      return { added, duplicates, repeated };
    });
  }

  async queueItems(runId: string): Promise<QueueItem[]> {
    return this.d.queue.where('runId').equals(runId).toArray();
  }

  async nextPending(runId: string): Promise<QueueItem | undefined> {
    const items = await this.d.queue
      .where('[runId+status]')
      .equals([runId, 'pending'])
      .sortBy('order');
    return items[0];
  }

  async markQueue(id: number, status: QueueItem['status'], error?: string): Promise<void> {
    await this.d.queue.update(id, error ? { status, error } : { status });
  }

  async queueCounts(
    runId: string,
  ): Promise<Record<QueueItem['status'], number> & { total: number }> {
    const items = await this.d.queue.where('runId').equals(runId).toArray();
    const counts = { pending: 0, done: 0, error: 0, skipped: 0, total: items.length };
    for (const it of items) counts[it.status]++;
    return counts;
  }

  async clearQueue(runId?: string): Promise<void> {
    if (runId) await this.d.queue.where('runId').equals(runId).delete();
    else await this.d.queue.clear();
  }

  // ── jobs ──
  /** Stores a job and records its URL in the history. Existing rows with the same URL are kept. */
  async addJob(job: Omit<JobRecord, 'key' | 'id'>): Promise<boolean> {
    const key = normalizeUrl(job.url);
    return this.d.transaction('rw', this.d.jobs, this.d.history, async () => {
      await this.d.history.put({ key, seenAt: Date.now() });
      if (await this.d.jobs.where('key').equals(key).count()) return false;
      await this.d.jobs.add({ ...job, key });
      return true;
    });
  }

  async allJobs(): Promise<JobRecord[]> {
    return this.d.jobs.orderBy('collectedAt').toArray();
  }

  async jobsForRun(runId: string): Promise<JobRecord[]> {
    return (await this.d.jobs.where('runId').equals(runId).toArray()).sort(
      (a, b) => a.collectedAt - b.collectedAt,
    );
  }

  async deleteJobs(ids: number[]): Promise<void> {
    await this.d.jobs.bulkDelete(ids);
  }

  async clearJobs(): Promise<void> {
    await this.d.jobs.clear();
  }
}

export const repo = new Repo();
