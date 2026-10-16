/**
 * Optional AI evaluation with the user's own Anthropic API key.
 *
 * Only runs when the user turned it on, entered a key and clicked "Rate with AI". The CV and
 * the selected job ads are then sent to api.anthropic.com – nowhere else. The key is stored in
 * chrome.storage.local on this device only.
 */
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import type { AiModel, AiRating, JobData, Language } from '../shared/types';

export const AI_MODELS: Array<{ id: AiModel; name: string }> = [
  { id: 'claude-opus-5-5', name: 'Claude Opus 5.5' },
  { id: 'claude-sonnet-5-5', name: 'Claude Sonnet 5.5' },
  { id: 'claude-haiku-5-5', name: 'Claude Haiku 5.5' },
];

/** Models with a server-side fallback when the safety classifiers decline a request. */
const FALLBACK_MODELS = new Set<AiModel>(['claude-opus-5-5', 'claude-sonnet-5-5']);

/** Keeps one request a reasonable size. */
export const MAX_JOB_CHARS = 12000;
export const API_ORIGIN = 'https://api.anthropic.com/*';
const KEY_STORAGE = 'anthropicApiKey';

const RatingSchema = z.object({
  score: z.number(),
  verdict: z.string(),
  matched_skills: z.array(z.string()),
  missing_skills: z.array(z.string()),
  keywords: z.array(z.string()),
});

const SYSTEM: Record<Language, string> = {
  en: `You are a careful career advisor. You compare the applicant's CV below with one job ad at a time.

Return:
- score: how well the applicant fits the job, 0–100 (80+ strong fit, 60–79 good, 40–59 partial, below 40 weak). Weigh the must-have requirements most.
- verdict: one or two sentences for the applicant: why it fits or not, and the main gap.
- matched_skills: requirements of the job that the CV clearly covers (short phrases).
- missing_skills: important requirements of the job that the CV does not show.
- keywords: the 8–12 most important keywords of the job ad (skills, tools, qualifications) – useful for tailoring the application.

Base everything only on the CV and the job ad. Do not invent experience the applicant does not have. Write in English.`,
  de: `Du bist ein sorgfältiger Karriereberater. Du vergleichst den Lebenslauf unten mit jeweils einer Stellenanzeige.

Gib zurück:
- score: wie gut die Person zur Stelle passt, 0–100 (ab 80 sehr gut, 60–79 gut, 40–59 teilweise, unter 40 wenig). Gewichte die Muss-Anforderungen am stärksten.
- verdict: ein bis zwei Sätze für die Person: warum es passt oder nicht und die wichtigste Lücke.
- matched_skills: Anforderungen der Stelle, die der Lebenslauf klar abdeckt (kurze Stichworte).
- missing_skills: wichtige Anforderungen der Stelle, die der Lebenslauf nicht zeigt.
- keywords: die 8–12 wichtigsten Schlüsselwörter der Anzeige (Fähigkeiten, Tools, Qualifikationen) – hilfreich, um die Bewerbung anzupassen.

Stütze dich nur auf den Lebenslauf und die Anzeige. Erfinde keine Erfahrung, die die Person nicht hat. Antworte auf Deutsch.`,
};

export async function loadApiKey(): Promise<string> {
  const data = await chrome.storage.local.get(KEY_STORAGE);
  return String(data[KEY_STORAGE] ?? '');
}

export async function saveApiKey(key: string): Promise<void> {
  if (key.trim()) await chrome.storage.local.set({ [KEY_STORAGE]: key.trim() });
  else await chrome.storage.local.remove(KEY_STORAGE);
}

/** The job as plain text for the request. */
export function jobPrompt(job: JobData): string {
  const head = [
    `Title: ${job.title}`,
    job.company && `Company: ${job.company}`,
    job.location && `Location: ${job.location}`,
    job.contractType && `Contract type: ${job.contractType}`,
  ].filter(Boolean);
  const body =
    job.description.length > MAX_JOB_CHARS
      ? `${job.description.slice(0, MAX_JOB_CHARS)} […]`
      : job.description;
  return `${head.join('\n')}\n\nJob ad:\n${body}`;
}

export type AiErrorCode = 'auth' | 'permission' | 'rateLimit' | 'refusal' | 'network' | 'other';

export class AiError extends Error {
  constructor(
    readonly code: AiErrorCode,
    message: string,
  ) {
    super(message);
  }
}

function toAiError(err: unknown): AiError {
  if (err instanceof AiError) return err;
  if (err instanceof Anthropic.AuthenticationError) return new AiError('auth', err.message);
  if (err instanceof Anthropic.PermissionDeniedError) return new AiError('permission', err.message);
  if (err instanceof Anthropic.RateLimitError) return new AiError('rateLimit', err.message);
  if (err instanceof Anthropic.APIConnectionError) return new AiError('network', err.message);
  if (err instanceof Anthropic.APIError) return new AiError('other', err.message);
  return new AiError('other', String(err));
}

const clampScore = (n: number): number => Math.max(0, Math.min(100, Math.round(n)));
const clean = (list: string[], max: number): string[] =>
  [...new Set(list.map((s) => s.trim()).filter(Boolean))].slice(0, max);

export function createClient(apiKey: string): Anthropic {
  // The key belongs to the user and stays in their browser; requests go straight to Anthropic.
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
}

/** Rates one job against the CV. */
export async function rateJob(
  client: Anthropic,
  cv: string,
  job: JobData,
  model: AiModel,
  lang: Language,
  signal?: AbortSignal,
): Promise<AiRating> {
  try {
    const response = await client.beta.messages.parse(
      {
        model,
        max_tokens: 16000,
        ...(FALLBACK_MODELS.has(model)
          ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }
          : {}),
        // Same instructions + CV for every job: cached after the first request.
        system: [
          {
            type: 'text',
            text: `${SYSTEM[lang]}\n\n=== CV ===\n${cv.trim()}`,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [{ role: 'user', content: jobPrompt(job) }],
        output_config: { effort: 'medium', format: betaZodOutputFormat(RatingSchema) },
      },
      { signal },
    );
    if (response.stop_reason === 'refusal') throw new AiError('refusal', 'declined');
    const out = response.parsed_output;
    if (!out) throw new AiError('other', `no result (${response.stop_reason ?? 'unknown'})`);
    return {
      score: clampScore(out.score),
      verdict: out.verdict.trim(),
      matched: clean(out.matched_skills, 15),
      missing: clean(out.missing_skills, 15),
      keywords: clean(out.keywords, 12),
      model: response.model,
      at: Date.now(),
    };
  } catch (err) {
    throw toAiError(err);
  }
}

/**
 * Rates several jobs one after another. Calls `onResult` after each job; stops at the first
 * error that affects every request (wrong key, no access, rate limit, network) and reports
 * per-job problems (e.g. a declined request) through `onResult` with the error.
 */
export async function rateJobs(opts: {
  apiKey: string;
  cv: string;
  jobs: JobData[];
  model: AiModel;
  lang: Language;
  signal?: AbortSignal;
  onResult: (job: JobData, rating: AiRating | null, error: AiError | null) => Promise<void> | void;
  /** For tests: a prepared client instead of one built from the key. */
  client?: Anthropic;
}): Promise<void> {
  const client = opts.client ?? createClient(opts.apiKey);
  for (const job of opts.jobs) {
    if (opts.signal?.aborted) return;
    let rating: AiRating | null = null;
    let problem: AiError | null = null;
    try {
      rating = await rateJob(client, opts.cv, job, opts.model, opts.lang, opts.signal);
    } catch (err) {
      if (opts.signal?.aborted) return;
      problem = toAiError(err);
      // Wrong key, no access, rate limit or no connection: every further job would fail too.
      if (problem.code !== 'refusal' && problem.code !== 'other') throw problem;
    }
    await opts.onResult(job, rating, problem);
  }
}
