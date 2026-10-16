/**
 * "Match with my CV" providers.
 *
 * The clipboard provider builds a prompt and the user pastes it into claude.ai (no key needed).
 * The per-job AI rating with the user's own API key lives in ./api.ts.
 */
import type { JobData, Language } from '../shared/types';
import { buildMatchPrompt } from './prompt';

export interface MatchRequest {
  cv: string;
  jobs: JobData[];
  lang: Language;
}

export type MatchOutcome =
  /** The prompt was copied; the user continues on claude.ai. */
  { kind: 'copied'; prompt: string };

export interface MatchProvider {
  readonly id: 'clipboard';
  run(req: MatchRequest): Promise<MatchOutcome>;
}

export class ClipboardProvider implements MatchProvider {
  readonly id = 'clipboard' as const;

  constructor(private readonly writeText: (text: string) => Promise<void>) {}

  async run(req: MatchRequest): Promise<MatchOutcome> {
    const prompt = buildMatchPrompt(req.cv, req.jobs, req.lang);
    await this.writeText(prompt);
    return { kind: 'copied', prompt };
  }
}

export function getProvider(deps: { writeText: (text: string) => Promise<void> }): MatchProvider {
  return new ClipboardProvider(deps.writeText);
}
