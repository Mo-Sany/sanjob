/**
 * "Match with my CV" providers.
 *
 * Today only the clipboard provider exists: it builds a prompt and the user pastes it into
 * claude.ai. A future API provider (user's own key, requests to api.anthropic.com only) can be
 * added by implementing `MatchProvider` and registering it in `getProvider` – the UI only
 * talks to this interface. Not implemented in this version: no API key is stored or used.
 */
import type { JobData, Language, Settings } from '../shared/types';
import { buildMatchPrompt } from './prompt';

export interface MatchRequest {
  cv: string;
  jobs: JobData[];
  lang: Language;
}

export type MatchOutcome =
  /** The prompt was copied; the user continues on claude.ai. */
  | { kind: 'copied'; prompt: string }
  /** Reserved for a future API mode: Claude's answer text. */
  | { kind: 'answer'; text: string };

export interface MatchProvider {
  readonly id: Settings['claudeMode'];
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

export function getProvider(
  mode: Settings['claudeMode'],
  deps: { writeText: (text: string) => Promise<void> },
): MatchProvider {
  switch (mode) {
    case 'clipboard':
      return new ClipboardProvider(deps.writeText);
  }
}
