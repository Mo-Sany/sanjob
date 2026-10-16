import Anthropic from '@anthropic-ai/sdk';
import { AiError, MAX_JOB_CHARS, jobPrompt, rateJobs } from '../src/claude/api';
import type { AiRating, JobData } from '../src/shared/types';

const job = (title: string): JobData => ({
  title,
  company: 'Muster GmbH',
  location: 'Bremen',
  datePosted: '',
  salary: '',
  contractType: 'Praktikum',
  url: `https://example.com/${title}`,
  description: 'Wir suchen Unterstützung in der Konstruktion. CATIA erforderlich.',
  tasks: '',
  profile: '',
  offer: '',
  other: '',
});

interface Captured {
  url: string;
  headers: Headers;
  body: Record<string, unknown>;
}

/** An Anthropic client whose HTTP calls are answered by `answer`. */
function fakeClient(
  answer: (body: Record<string, unknown>) => { status: number; json: unknown },
  calls: Captured[],
): Anthropic {
  return new Anthropic({
    apiKey: 'sk-ant-test',
    dangerouslyAllowBrowser: true,
    maxRetries: 0,
    fetch: async (url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      calls.push({ url: String(url), headers: new Headers(init?.headers), body });
      const res = answer(body);
      return new Response(JSON.stringify(res.json), {
        status: res.status,
        headers: { 'content-type': 'application/json' },
      });
    },
  });
}

const message = (text: string, stop = 'end_turn') => ({
  id: 'msg_1',
  type: 'message',
  role: 'assistant',
  model: 'claude-opus-5-5',
  content: text ? [{ type: 'text', text }] : [],
  stop_reason: stop,
  stop_sequence: null,
  usage: { input_tokens: 10, output_tokens: 10 },
});

const RATING = {
  score: 104.4,
  verdict: 'Passt gut: CATIA vorhanden.',
  matched_skills: ['CATIA', 'CATIA', ' Maschinenbau '],
  missing_skills: ['Englisch'],
  keywords: ['CATIA', 'Konstruktion'],
};

describe('AI rating (Claude API, faked)', () => {
  it('sends one structured request per job with the CV cached in the system prompt', async () => {
    const calls: Captured[] = [];
    const client = fakeClient(
      () => ({ status: 200, json: message(JSON.stringify(RATING)) }),
      calls,
    );
    const results: Array<AiRating | null> = [];
    await rateJobs({
      apiKey: 'sk-ant-test',
      cv: 'Student Maschinenbau, CATIA',
      jobs: [job('A'), job('B')],
      model: 'claude-opus-5-5',
      lang: 'de',
      client,
      onResult: (_job, rating) => void results.push(rating),
    });
    expect(calls).toHaveLength(2);
    const { url, headers, body } = calls[0]!;
    expect(url).toBe('https://api.anthropic.com/v1/messages?beta=true');
    expect(headers.get('anthropic-beta')).toContain('server-side-fallback-2026-07-01');
    expect(body['model']).toBe('claude-opus-5-5');
    expect(body['fallbacks']).toBe('default');
    expect(body['thinking']).toBeUndefined();
    const system = body['system'] as Array<{ text: string; cache_control: unknown }>;
    expect(system[0]!.text).toContain('=== CV ===\nStudent Maschinenbau, CATIA');
    expect(system[0]!.cache_control).toEqual({ type: 'ephemeral' });
    const output = body['output_config'] as { effort: string; format: { type: string } };
    expect(output.effort).toBe('medium');
    expect(output.format.type).toBe('json_schema');
    expect(results[0]).toMatchObject({
      score: 100,
      verdict: 'Passt gut: CATIA vorhanden.',
      matched: ['CATIA', 'Maschinenbau'],
      missing: ['Englisch'],
      keywords: ['CATIA', 'Konstruktion'],
      model: 'claude-opus-5-5',
    });
  });

  it('does not send fallbacks for Haiku (no server-side fallback there)', async () => {
    const calls: Captured[] = [];
    const client = fakeClient(
      () => ({ status: 200, json: message(JSON.stringify(RATING)) }),
      calls,
    );
    await rateJobs({
      apiKey: 'k',
      cv: 'cv',
      jobs: [job('A')],
      model: 'claude-haiku-5-5',
      lang: 'en',
      client,
      onResult: () => {},
    });
    expect(calls[0]!.body['fallbacks']).toBeUndefined();
    expect(calls[0]!.headers.get('anthropic-beta') ?? '').not.toContain('server-side-fallback');
  });

  it('skips a declined job and continues with the next one', async () => {
    const calls: Captured[] = [];
    let n = 0;
    const client = fakeClient(
      () =>
        n++ === 0
          ? { status: 200, json: message('', 'refusal') }
          : { status: 200, json: message(JSON.stringify(RATING)) },
      calls,
    );
    const seen: Array<[string, string | null]> = [];
    await rateJobs({
      apiKey: 'k',
      cv: 'cv',
      jobs: [job('A'), job('B')],
      model: 'claude-opus-5-5',
      lang: 'en',
      client,
      onResult: (j, rating, err) => void seen.push([j.title, rating ? 'ok' : err!.code]),
    });
    expect(seen).toEqual([
      ['A', 'refusal'],
      ['B', 'ok'],
    ]);
  });

  it('stops at once when the key is not accepted', async () => {
    const calls: Captured[] = [];
    const client = fakeClient(
      () => ({
        status: 401,
        json: {
          type: 'error',
          error: { type: 'authentication_error', message: 'invalid x-api-key' },
        },
      }),
      calls,
    );
    const run = rateJobs({
      apiKey: 'bad',
      cv: 'cv',
      jobs: [job('A'), job('B')],
      model: 'claude-opus-5-5',
      lang: 'en',
      client,
      onResult: () => {},
    });
    await expect(run).rejects.toBeInstanceOf(AiError);
    await expect(run).rejects.toMatchObject({ code: 'auth' });
    expect(calls).toHaveLength(1);
  });

  it('shortens very long ads', () => {
    const long = { ...job('A'), description: 'x'.repeat(MAX_JOB_CHARS + 500) };
    expect(jobPrompt(long)).toMatch(/x \[…\]$/);
    expect(jobPrompt(job('A'))).toContain('Title: A\nCompany: Muster GmbH');
  });
});
