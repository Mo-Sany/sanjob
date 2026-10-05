// @vitest-environment-options {"url": "https://www.xing.com/jobs/search?keywords=Elektroniker"}
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { unwatch, watch } from '../src/content/watch';

const sent: unknown[] = [];

beforeEach(() => {
  vi.useFakeTimers();
  sent.length = 0;
  (globalThis as unknown as { chrome: unknown }).chrome = {
    runtime: { sendMessage: (m: unknown) => (sent.push(m), Promise.resolve()) },
  };
  const html = readFileSync(resolve(__dirname, '../fixtures/xing/search.synthetic.html'), 'utf8');
  document.documentElement.innerHTML = html
    .replace(/^[\s\S]*?<html[^>]*>/i, '')
    .replace(/<\/html>\s*$/i, '');
});

afterEach(() => {
  unwatch();
  vi.useRealTimers();
});

describe('continuous mode watcher', () => {
  it('returns the jobs on the page, then reports only NEW jobs that appear when scrolling', async () => {
    const first = watch(undefined, 100);
    expect(first.map((l) => l.url)).toEqual([
      'https://www.xing.com/jobs/hamburg-elektroniker-m-w-d-123456789',
      'https://www.xing.com/jobs/hamburg-servicetechniker-elektrotechnik-987654321',
    ]);

    // Infinite scroll appends a new card.
    const li = document.createElement('li');
    li.innerHTML =
      '<article><a data-testid="job-search-result" href="/jobs/bremen-mechatroniker-555555555"><h2>Mechatroniker</h2></a></article>';
    document.querySelector('ol')!.append(li);
    await vi.advanceTimersByTimeAsync(150);

    expect(sent).toEqual([
      {
        type: 'watchLinks',
        url: 'https://www.xing.com/jobs/search?keywords=Elektroniker',
        links: [
          {
            url: 'https://www.xing.com/jobs/bremen-mechatroniker-555555555',
            hints: { title: 'Mechatroniker' },
          },
        ],
      },
    ]);

    // Nothing new → nothing sent.
    window.dispatchEvent(new Event('scroll'));
    await vi.advanceTimersByTimeAsync(150);
    expect(sent).toHaveLength(1);
  });
});
