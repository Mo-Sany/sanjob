import { levelOf, type MatchLevel, type MatchResult } from '../../match/local';
import { fmt, type Strings } from '../../shared/i18n';
import type { JobRecord } from '../../shared/types';

const LEVEL_CLASS: Record<MatchLevel, string> = {
  high: 'bg-emerald-600 text-white',
  good: 'bg-teal-100 text-teal-900 dark:bg-teal-800 dark:text-teal-50',
  partial: 'bg-amber-100 text-amber-900 dark:bg-amber-800 dark:text-amber-50',
  low: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
};

/** The score shown for a job: Claude's rating when there is one, else the local one. */
export function fitScore(job: JobRecord, match: MatchResult | undefined): number | null {
  return job.ai?.score ?? match?.score ?? null;
}

export function FitBadge({
  t,
  job,
  match,
}: {
  t: Strings;
  job: JobRecord;
  match: MatchResult | undefined;
}) {
  const score = fitScore(job, match);
  if (score === null) return <span class="text-slate-400">–</span>;
  const level = levelOf(score);
  return (
    <span
      class={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${LEVEL_CLASS[level]}`}
      title={t.fit.levels[level]}
    >
      {score}%{job.ai && <span class="text-[9px] opacity-80">{t.ai.score}</span>}
    </span>
  );
}

function Chips({
  t,
  words,
  tone,
  match,
}: {
  t: Strings;
  words: string[];
  tone: 'match' | 'miss' | 'plain';
  match: MatchResult | undefined;
}) {
  const optional = new Set(match?.optional ?? []);
  const required = new Set(match?.required ?? []);
  const cls =
    tone === 'match'
      ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-50'
      : tone === 'miss'
        ? 'bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-50'
        : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-100';
  return (
    <div class="flex flex-wrap gap-1">
      {words.map((w) => (
        <span
          key={w}
          class={`rounded-md px-1.5 py-0.5 text-[11px] ${cls} ${
            optional.has(w) ? 'border border-dashed border-current opacity-75' : ''
          } ${required.has(w) ? 'font-semibold' : ''}`}
          title={required.has(w) ? t.fit.required : optional.has(w) ? t.fit.optional : undefined}
        >
          {required.has(w) && '❗'}
          {w}
          {optional.has(w) && <span class="opacity-70"> ({t.fit.optionalShort})</span>}
        </span>
      ))}
    </div>
  );
}

/** Keywords + what is (not) in the CV, and Claude's verdict when available. */
export function FitDetails({
  t,
  job,
  match,
  hasCv,
}: {
  t: Strings;
  job: JobRecord;
  match: MatchResult | undefined;
  hasCv: boolean;
}) {
  const ai = job.ai;
  const matched = ai?.matched ?? match?.matched ?? [];
  const missing = ai?.missing ?? match?.missing ?? [];
  const keywords = ai?.keywords.length ? ai.keywords : (match?.keywords ?? []);
  const score = fitScore(job, match);
  return (
    <div class="mt-2 flex flex-col gap-2 rounded-lg bg-white p-2 dark:bg-slate-800">
      {score !== null ? (
        <div class="flex items-center gap-2">
          <FitBadge t={t} job={job} match={match} />
          <span class="font-medium">{t.fit.levels[levelOf(score)]}</span>
        </div>
      ) : (
        hasCv && <span class="text-xs text-slate-500">{t.fit.noScore}</span>
      )}
      {ai?.verdict && (
        <p class="text-xs">
          <span class="font-semibold">{t.ai.verdict}: </span>
          {ai.verdict}
        </p>
      )}
      {keywords.length > 0 && (
        <div class="flex flex-col gap-1">
          <span class="text-[11px] font-semibold text-slate-500 uppercase">{t.fit.keywords}</span>
          <Chips t={t} words={keywords} tone="plain" match={match} />
        </div>
      )}
      {hasCv && matched.length > 0 && (
        <div class="flex flex-col gap-1">
          <span class="text-[11px] font-semibold text-slate-500 uppercase">{t.fit.matched}</span>
          <Chips t={t} words={matched} tone="match" match={match} />
        </div>
      )}
      {hasCv && missing.length > 0 && (
        <div class="flex flex-col gap-1">
          <span class="text-[11px] font-semibold text-slate-500 uppercase">{t.fit.missing}</span>
          <Chips t={t} words={missing} tone="miss" match={match} />
        </div>
      )}
    </div>
  );
}

/** "Best matches" card above the table, or a hint to add the CV. */
export function BestMatches({
  t,
  jobs,
  matches,
  hasCv,
  onOpen,
  onAddCv,
}: {
  t: Strings;
  jobs: JobRecord[];
  matches: Map<string, MatchResult>;
  hasCv: boolean;
  onOpen: (job: JobRecord) => void;
  onAddCv: () => void;
}) {
  if (!jobs.length) return null;
  if (!hasCv) {
    return (
      <div class="flex items-center gap-2 rounded-lg bg-teal-50 p-2 text-xs dark:bg-teal-950">
        <span class="flex-1">{t.fit.noCv}</span>
        <button class="btn" onClick={onAddCv}>
          {t.fit.addCv}
        </button>
      </div>
    );
  }
  const top = jobs
    .map((job) => ({ job, score: fitScore(job, matches.get(job.url)) }))
    .filter((x): x is { job: JobRecord; score: number } => x.score !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
  if (!top.length) return null;
  return (
    <div class="flex flex-col gap-1 rounded-lg bg-teal-50 p-2 dark:bg-teal-950">
      <span class="font-semibold">{t.fit.best}</span>
      <span class="text-[11px] text-slate-500 dark:text-slate-400">{t.fit.bestHint}</span>
      <ol class="flex flex-col gap-1">
        {top.map(({ job }, i) => (
          <li key={job.id} class="flex items-center gap-2">
            <span class="w-4 text-right text-xs text-slate-500">{i + 1}.</span>
            <FitBadge t={t} job={job} match={matches.get(job.url)} />
            <button
              class="flex-1 truncate text-left text-xs text-teal-800 hover:underline dark:text-teal-300"
              title={fmt('{title} – {company}', { title: job.title, company: job.company })}
              onClick={() => onOpen(job)}
            >
              {job.title}
              {job.company && <span class="text-slate-500"> – {job.company}</span>}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
