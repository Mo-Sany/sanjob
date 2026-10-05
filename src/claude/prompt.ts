import type { JobData, Language, SectionField } from '../shared/types';

type PromptField = Exclude<keyof JobData, SectionField>;

/** Keeps prompts a reasonable size when many jobs are selected. */
export const MAX_DESCRIPTION_CHARS_PER_JOB = 6000;

const INSTRUCTIONS: Record<Language, string> = {
  en: `You are a careful career advisor. Compare my CV with each job posting below.
For EACH job, answer with exactly this structure:

### <job number>. <job title> – <company>
- Match score: <0-100>
- Matching skills: <comma-separated list>
- Missing skills: <comma-separated list>
- Verdict: <one line>

Base your assessment only on the CV and the job text. Do not invent experience I do not have.`,
  de: `Du bist ein sorgfältiger Karriereberater. Vergleiche meinen Lebenslauf mit jeder der folgenden Stellenanzeigen.
Antworte für JEDE Stelle genau in dieser Struktur:

### <Nummer>. <Jobtitel> – <Unternehmen>
- Match-Score: <0-100>
- Passende Fähigkeiten: <kommagetrennte Liste>
- Fehlende Fähigkeiten: <kommagetrennte Liste>
- Fazit: <eine Zeile>

Stütze dich nur auf den Lebenslauf und den Anzeigentext. Erfinde keine Erfahrung, die ich nicht habe.`,
};

const LABELS: Record<Language, { cv: string; job: string; fields: Record<PromptField, string> }> = {
  en: {
    cv: 'MY CV / SKILLS',
    job: 'JOB',
    fields: {
      title: 'Title',
      company: 'Company',
      location: 'Location',
      datePosted: 'Date posted',
      salary: 'Salary',
      contractType: 'Contract type',
      url: 'URL',
      description: 'Description',
    },
  },
  de: {
    cv: 'MEIN LEBENSLAUF / FÄHIGKEITEN',
    job: 'STELLE',
    fields: {
      title: 'Titel',
      company: 'Unternehmen',
      location: 'Ort',
      datePosted: 'Veröffentlicht',
      salary: 'Gehalt',
      contractType: 'Vertragsart',
      url: 'URL',
      description: 'Beschreibung',
    },
  },
};

function jobBlock(job: JobData, index: number, lang: Language): string {
  const l = LABELS[lang];
  const description =
    job.description.length > MAX_DESCRIPTION_CHARS_PER_JOB
      ? `${job.description.slice(0, MAX_DESCRIPTION_CHARS_PER_JOB)} […]`
      : job.description;
  const lines = (
    ['title', 'company', 'location', 'datePosted', 'salary', 'contractType', 'url'] as const
  )
    .filter((k) => job[k])
    .map((k) => `${l.fields[k]}: ${job[k]}`);
  return `=== ${l.job} ${index + 1} ===\n${lines.join('\n')}\n${l.fields.description}:\n${description}`;
}

/** One ready-to-paste prompt: instructions + CV + job data. */
export function buildMatchPrompt(cv: string, jobs: JobData[], lang: Language): string {
  const l = LABELS[lang];
  return [
    INSTRUCTIONS[lang],
    `=== ${l.cv} ===\n${cv.trim()}`,
    ...jobs.map((job, i) => jobBlock(job, i, lang)),
  ].join('\n\n');
}
