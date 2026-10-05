// @vitest-environment-options {"url": "https://de.indeed.com/jobs?q=Elektroniker&l=Hamburg"}
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildLiveUpdate, liveStatus, remainingSeconds } from '../src/background/live';
import {
  MIN_SCROLL_GAP_MS,
  SWEEP_STEP_MS,
  USER_SCROLL_PAUSE_MS,
  applyLiveUpdate,
  liveViewForTests,
} from '../src/content/liveview';
import type { LiveStatus, LiveUpdate, QueueItem, RunState } from '../src/shared/types';
import { normalizeUrl } from '../src/shared/url';

const A = normalizeUrl('https://de.indeed.com/viewjob?jk=aaaa111122223333');
const B = normalizeUrl('https://de.indeed.com/viewjob?jk=bbbb111122223333');

const update = (
  items: Array<[string, LiveStatus]>,
  focus: string | null = null,
  patch: Partial<LiveUpdate> = {},
): LiveUpdate => ({
  action: 'sync',
  items,
  focus,
  done: items.filter(([, s]) => s === 'done').length,
  total: items.length,
  remainingSec: 120,
  language: 'en',
  ...patch,
});

const view = () => liveViewForTests()!.snapshot();
let scrolls: Array<{ el: Element; opts: ScrollIntoViewOptions }> = [];

beforeEach(() => {
  vi.useFakeTimers();
  const html = readFileSync(resolve(__dirname, '../fixtures/indeed/search.synthetic.html'), 'utf8');
  document.documentElement.innerHTML = html
    .replace(/^[\s\S]*?<html[^>]*>/i, '')
    .replace(/<\/html>\s*$/i, '');
  scrolls = [];
  Element.prototype.scrollIntoView = function (
    this: Element,
    opts?: boolean | ScrollIntoViewOptions,
  ) {
    scrolls.push({ el: this, opts: opts as ScrollIntoViewOptions });
  };
});

afterEach(() => {
  applyLiveUpdate(update([], null, { action: 'clear' }));
  vi.useRealTimers();
});

describe('live view on a results page', () => {
  it('sweeps queued cards top to bottom, then follows the real progress: queued → in progress → done', () => {
    applyLiveUpdate(
      update([
        [A, 'queued'],
        [B, 'queued'],
      ]),
    );
    expect(view().statuses).toEqual({ [A]: 'queued', [B]: null });
    expect(scrolls[0]?.opts).toEqual({ behavior: 'smooth', block: 'center' });
    vi.advanceTimersByTime(SWEEP_STEP_MS);
    expect(view().statuses).toEqual({ [A]: 'queued', [B]: 'queued' });

    vi.advanceTimersByTime(MIN_SCROLL_GAP_MS + 100);
    applyLiveUpdate(
      update(
        [
          [A, 'progress'],
          [B, 'queued'],
        ],
        A,
      ),
    );
    expect(view().statuses).toEqual({ [A]: 'progress', [B]: 'queued' });
    expect(view().badges).toEqual(['Collecting…']);
    expect(scrolls.at(-1)?.el.textContent).toContain('Elektroniker');

    vi.advanceTimersByTime(MIN_SCROLL_GAP_MS + 100);
    applyLiveUpdate(
      update(
        [
          [A, 'done'],
          [B, 'progress'],
        ],
        B,
      ),
    );
    expect(view().statuses).toEqual({ [A]: 'done', [B]: 'progress' });
    expect(view().badges).toEqual(['✓', 'Collecting…']);
    expect(scrolls.at(-1)?.el.textContent).toContain('Mechatroniker');

    applyLiveUpdate(
      update([
        [A, 'done'],
        [B, 'done'],
      ]),
    );
    expect(view().statuses).toEqual({ [A]: 'done', [B]: 'done' });
  });

  it('shows "Already saved" and "Skipped" badges, never the word error', () => {
    applyLiveUpdate(
      update([
        [A, 'dup'],
        [B, 'skipped'],
      ]),
    );
    expect(view().badges).toEqual(['Already saved', 'Skipped']);
    applyLiveUpdate(
      update(
        [
          [A, 'dup'],
          [B, 'skipped'],
        ],
        null,
        { language: 'de' },
      ),
    );
    expect(view().statuses).toEqual({ [A]: 'dup', [B]: 'skipped' });
  });

  it('pauses auto-scroll for 5 s after a manual scroll, then continues from the current job', () => {
    applyLiveUpdate(
      update([
        [A, 'queued'],
        [B, 'queued'],
      ]),
    );
    vi.advanceTimersByTime(1000);
    window.dispatchEvent(new Event('wheel'));
    const before = scrolls.length;
    applyLiveUpdate(
      update(
        [
          [A, 'done'],
          [B, 'progress'],
        ],
        B,
      ),
    );
    expect(scrolls.length).toBe(before);
    vi.advanceTimersByTime(USER_SCROLL_PAUSE_MS + 100);
    expect(scrolls.length).toBe(before + 1);
    expect(scrolls.at(-1)?.el.textContent).toContain('Mechatroniker');
  });

  it('throttles scrolling to one scroll per 400 ms', () => {
    applyLiveUpdate(
      update(
        [
          [A, 'progress'],
          [B, 'queued'],
        ],
        A,
      ),
    );
    const n = scrolls.length;
    applyLiveUpdate(
      update(
        [
          [A, 'done'],
          [B, 'progress'],
        ],
        B,
      ),
    );
    expect(scrolls.length).toBe(n);
    vi.advanceTimersByTime(MIN_SCROLL_GAP_MS + 20);
    expect(scrolls.length).toBe(n + 1);
  });

  it('shows the progress chip and keeps only ✓ marks when the run ends', () => {
    applyLiveUpdate(
      update(
        [
          [A, 'done'],
          [B, 'queued'],
        ],
        null,
        { done: 1, total: 2 },
      ),
    );
    vi.advanceTimersByTime(600); // the count ticks up
    expect(view().chip).toBe('✓ 1 / 2 · ~2 min left');
    applyLiveUpdate(
      update(
        [
          [A, 'done'],
          [B, 'queued'],
        ],
        null,
        { action: 'end', done: 1, total: 2 },
      ),
    );
    expect(view().statuses).toEqual({ [A]: 'done', [B]: null });
    expect(view().chip).toContain('1 collected');
    expect(view().chip).toContain('Clear marks');
  });

  it('removes everything on clear, without touching the page layout', () => {
    const before = document.body.innerHTML;
    applyLiveUpdate(
      update([
        [A, 'queued'],
        [B, 'done'],
      ]),
    );
    const host = document.querySelector('sanjob-live') as HTMLElement;
    expect(host.style.position).toBe('fixed');
    expect(host.style.pointerEvents).toBe('none');
    expect(document.body.innerHTML).toBe(before); // overlay lives outside <body>
    applyLiveUpdate(update([], null, { action: 'clear' }));
    expect(document.querySelector('sanjob-live')).toBeNull();
    expect(liveViewForTests()).toBeNull();
  });
});

describe('live state from the real queue', () => {
  const item = (key: string, status: QueueItem['status']): QueueItem => ({
    runId: 'r',
    url: key,
    key,
    status,
    order: 0,
  });

  it('maps queue status and the job being read', () => {
    expect(liveStatus(item(A, 'pending'), A)).toBe('progress');
    expect(liveStatus(item(B, 'pending'), A)).toBe('queued');
    expect(liveStatus(item(A, 'done'), A)).toBe('done');
    expect(liveStatus(item(A, 'skipped'), null)).toBe('dup');
    expect(liveStatus(item(A, 'error'), null)).toBe('skipped');
  });

  it('only marks a job "in progress" while it is really being read', () => {
    const state = {
      runId: 'r',
      phase: 'details',
      status: 'running',
      current: 'https://de.indeed.com/viewjob?jk=aaaa111122223333',
      done: 3,
      errors: 1,
      total: 10,
      avgItemMs: 6000,
    } as RunState;
    const settings = { language: 'de' as const, delayMinSec: 3, delayMaxSec: 6 };
    const u = buildLiveUpdate(state, [item(A, 'pending'), item(B, 'pending')], settings, 'sync');
    expect(u.focus).toBe(A);
    expect(u.items).toEqual([
      [A, 'progress'],
      [B, 'queued'],
    ]);
    expect(remainingSeconds(state, 3, 6)).toBe(36);
    const paused = buildLiveUpdate(
      { ...state, status: 'paused' },
      [item(A, 'pending')],
      settings,
      'sync',
    );
    expect(paused.items).toEqual([[A, 'queued']]);
  });
});
