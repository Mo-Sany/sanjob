/**
 * Local CV ↔ job matching (no AI, nothing leaves the browser).
 *
 * 1. Job keywords: skills from the dictionary (skills.ts) found in the ad, plus words that are
 *    typical for this ad compared to all collected ads (tf-idf), e.g. "Kabelbaum" or "Avionik".
 * 2. Weights: a keyword under "Ihr Profil" counts 3, in the title 2, elsewhere 1.
 * 3. Score = weighted share of the job's keywords that also appear in the CV (80 %) plus the
 *    share of title words found in the CV (20 %), as 0–100.
 */
import type { JobData } from '../shared/types';
import { SKILLS } from './skills';

export type MatchLevel = 'high' | 'good' | 'partial' | 'low';

export interface MatchResult {
  /** 0–100, or null when the ad has too little text to judge. */
  score: number | null;
  level: MatchLevel | null;
  /** The job's keywords, most important first. */
  keywords: string[];
  /** Keywords that also appear in the CV. */
  matched: string[];
  /** Keywords the CV does not mention. */
  missing: string[];
}

export const MAX_KEYWORDS = 12;
const FREE_KEYWORDS = 6;

export function levelOf(score: number): MatchLevel {
  if (score >= 70) return 'high';
  if (score >= 45) return 'good';
  if (score >= 25) return 'partial';
  return 'low';
}

// ── text helpers ──

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

/** Lowercase, no soft hyphens, unified dashes and spaces. */
export function normalizeText(text: string): string {
  return text.toLowerCase().replace(/­/g, '').replace(/[‐-―]/g, '-').replace(/\s+/g, ' ');
}

const STOPWORDS = new Set(
  `aber alle allem allen aller alles also als andere anderen anderer anderes auch auf aus bei beim bereits bevor bin bis bist bitte da dabei dadurch dafür dagegen daher damit danach dann darauf daran darum das dass dein deine deinem deinen deiner dem den denen der deren des deshalb dessen die dies diese diesem diesen dieser dieses doch dort du durch ein eine einem einen einer eines einige einigen etwa etwas euch euer eure für gegen gerne habe haben hast hat hier hin hinter ich ihm ihn ihnen ihr ihre ihrem ihren ihrer ihres im immer in ins ist jede jedem jeden jeder jedes jetzt kann kannst kein keine können könnt machen man mehr mein meine mit muss musst nach neben nicht noch nun nur ob oder ohne sehr sein seine sich sie sind so sodass solche soll sollen sollte sowie über um und uns unser unsere unserem unseren unserer unter viel viele vom von vor während war waren was weil weitere weiteren welche wenn werden wie wir wird wirst wo wollen zu zum zur zwischen
  about above after again against all also and any are because been before being below between both but can could did does doing down during each few for from further had has have having her here hers herself him himself his how into its itself just more most must not now off once only other our ours out over own same she should some such than that the their theirs them then there these they this those through too under until very was were what when where which while who whom why will with would you your yours yourself
  aufgaben aufgabe profil bieten bietet biete bewerbung bewerben bewirb bewerbungen unternehmen firma mitarbeiter mitarbeiterin mitarbeitende kollegen kolleginnen team teams stelle stellen position job jobs arbeit arbeiten tätigkeit tätigkeiten bereich bereichen bereiche kenntnisse erfahrung erfahrungen idealerweise wünschenswert vorteil vorteilhaft gute guten gutes sehr erste ersten ersten möglichkeit möglichkeiten rahmen sowie bzw. etc zudem außerdem gemeinsam freuen freust freut interesse interessiert spannende spannenden spannend vielfältige vielfältigen abwechslungsreiche abwechslungsreichen neue neuen neues unsere unseren standort standorte region kunden kunde ansprechpartner kontakt fragen m/w/d w/m/d m/w/x d/m/w mwd (m/w/d) vollzeit teilzeit unbefristet befristet woche wochen monate monaten jahre jahren tage tagen deutschland gmbh
  erstellung durchführung mitarbeit praktikant praktikantin dinge schritt schritte option optionen positionen unterstützung experten expertinnen richtige zukunft karriere chance chancen ideen kenntnis vergütung urlaub gehalt zusatzleistungen leistungen voraussetzung voraussetzungen anforderungen qualifikation qualifikationen kompetenzen fähigkeiten eigenschaften wünsche ziele
  responsibilities requirements qualifications benefits offer company role position opportunity opportunities experience skills knowledge working work team candidate candidates apply application applications looking join including strong ability within across years year based support`.split(
    /\s+/,
  ),
);

/** Word tokens (letters, digits and + # . inside words), lowercase. */
export function tokens(text: string): string[] {
  return normalizeText(text).match(/[\p{L}\p{N}][\p{L}\p{N}+#.]*[\p{L}\p{N}+#]|[\p{L}]/gu) ?? [];
}

const SUFFIXES = ['ungen', 'ung', 'ern', 'en', 'er', 'es', 'em', 'e', 's'];

/** Light German/English stemming: enough to match "Konstruktionen" with "Konstruktion". */
export function stem(word: string): string {
  for (const suf of SUFFIXES) {
    // "Prozess" keeps its double s ("prozesse" → "prozess").
    if (suf === 's' && word.endsWith('ss')) continue;
    if (word.endsWith(suf) && word.length - suf.length >= 4) return word.slice(0, -suf.length);
  }
  return word;
}

const isKeywordToken = (t: string): boolean =>
  t.length >= 5 && !STOPWORDS.has(t) && !/^\d/.test(t) && /\p{L}/u.test(t);

// ── skills ──

interface SkillMatcher {
  name: string;
  re: RegExp;
  /** One-word spellings (≥ 6 letters), also matched inside CV compounds. */
  words: string[];
}

const SKILL_MATCHERS: SkillMatcher[] = SKILLS.map(([name, ...aliases]) => {
  const spellings = [name!, ...aliases].map(normalizeText);
  return {
    name: name!,
    re: new RegExp(
      `(?<![\\p{L}\\p{N}])(${spellings.map(escapeRe).join('|')})(?![\\p{L}\\p{N}])`,
      'u',
    ),
    words: spellings.filter((a) => /^\p{L}{6,}$/u.test(a)),
  };
});
const SKILL_BY_NAME = new Map(SKILL_MATCHERS.map((m) => [m.name, m]));

/** Dictionary skills mentioned in a text (display names, in dictionary order). */
export function findSkills(text: string): string[] {
  const n = normalizeText(text);
  return SKILL_MATCHERS.filter((m) => m.re.test(n)).map((m) => m.name);
}

// ── CV ──

export interface CvProfile {
  skills: Set<string>;
  stems: Set<string>;
}

export function analyzeCv(cv: string): CvProfile {
  return {
    skills: new Set(findSkills(cv)),
    stems: new Set(tokens(cv).map(stem)),
  };
}

function cvHasWord(cv: CvProfile, word: string): boolean {
  const s = stem(word);
  if (cv.stems.has(s)) return true;
  // German compounds: "Konstruktion" is part of "Konstruktionserfahrung".
  if (s.length < 6) return false;
  for (const c of cv.stems) if (c.length > s.length && c.startsWith(s)) return true;
  return false;
}

const skillWordCache = new Map<string, boolean>();
function isSkillWord(word: string): boolean {
  let hit = skillWordCache.get(word);
  if (hit === undefined) {
    hit = findSkills(word).length > 0;
    if (skillWordCache.size > 20000) skillWordCache.clear();
    skillWordCache.set(word, hit);
  }
  return hit;
}

/** "Konstruktion" also counts when the CV says "Konstruktionserfahrung". */
function cvHasSkill(cv: CvProfile, name: string): boolean {
  if (cv.skills.has(name)) return true;
  return (SKILL_BY_NAME.get(name)?.words ?? []).some((w) => cvHasWord(cv, w));
}

// ── corpus (document frequency over all collected jobs) ──

export interface Corpus {
  size: number;
  df: Map<string, number>;
}

const jobText = (job: JobData): string =>
  [job.title, job.tasks, job.profile, job.tasks || job.profile ? '' : job.description].join('\n');

export function buildCorpus(jobs: JobData[]): Corpus {
  const df = new Map<string, number>();
  for (const job of jobs) {
    for (const t of new Set(tokens(jobText(job)).filter(isKeywordToken).map(stem))) {
      df.set(t, (df.get(t) ?? 0) + 1);
    }
  }
  return { size: jobs.length, df };
}

/** Words typical for this ad (tf-idf over the corpus), as they are written in the ad. */
function freeKeywords(job: JobData, corpus: Corpus, exclude: Set<string>): string[] {
  const original = new Map<string, string>();
  const tf = new Map<string, number>();
  const text = jobText(job);
  for (const m of text.matchAll(/[\p{L}][\p{L}\p{N}+#-]*[\p{L}\p{N}+#]/gu)) {
    const word = m[0];
    const t = word.toLowerCase();
    if (!isKeywordToken(t) || t.includes('-')) continue;
    const s = stem(t);
    // "Englischkenntnisse" is already covered by the skill "Englisch".
    if (exclude.has(s) || isSkillWord(t)) continue;
    tf.set(s, (tf.get(s) ?? 0) + 1);
    // Prefer the capitalized spelling (German nouns).
    if (!original.has(s) || /^\p{Lu}/u.test(word)) original.set(s, word);
  }
  // In German ads only nouns (capitalized) are keywords – verbs and adjectives say little.
  const german = isGerman(text);
  if (german) for (const [st, word] of original) if (!/^\p{Lu}/u.test(word)) tf.delete(st);
  const n = Math.max(1, corpus.size);
  const scored = [...tf.entries()]
    .map(([s, f]) => {
      const df = corpus.df.get(s) ?? 1;
      // Words in most collected ads say little about this one.
      if (n >= 4 && df / n > 0.6) return null;
      return {
        s,
        score: f * Math.log((n + 1) / (df + 0.5)) * (/^\p{Lu}/u.test(original.get(s)!) ? 1.3 : 1),
      };
    })
    .filter((x): x is { s: string; score: number } => x !== null)
    .sort((a, b) => b.score - a.score || a.s.localeCompare(b.s));
  return scored.slice(0, FREE_KEYWORDS).map((x) => original.get(x.s)!);
}

const GERMAN_HINTS = /(?<![\p{L}])(und|die|der|das|mit|für|wir|sie|ihre|deine|du)(?![\p{L}])/giu;
const ENGLISH_HINTS = /(?<![\p{L}])(and|the|with|for|we|you|your|our)(?![\p{L}])/giu;

function isGerman(text: string): boolean {
  return (text.match(GERMAN_HINTS)?.length ?? 0) >= (text.match(ENGLISH_HINTS)?.length ?? 0);
}

// ── scoring ──

/** Keywords of a job with their weights (no CV needed). */
export function jobKeywords(
  job: JobData,
  corpus: Corpus,
): Array<{ word: string; weight: number; skill: boolean }> {
  const inProfile = new Set(findSkills(job.profile));
  const inTitle = new Set(findSkills(job.title));
  const sectioned = Boolean(job.tasks || job.profile);
  const skills = findSkills(jobText(job));
  const list = skills.map((name) => ({
    word: name,
    weight: inProfile.has(name) ? 3 : inTitle.has(name) ? 2 : sectioned ? 1 : 2,
    skill: true,
  }));
  const skillStems = new Set(skills.flatMap((s) => tokens(s).map(stem)));
  for (const word of freeKeywords(job, corpus, skillStems)) {
    list.push({ word, weight: 1, skill: false });
  }
  return list
    .sort((a, b) => b.weight - a.weight || Number(b.skill) - Number(a.skill))
    .slice(0, MAX_KEYWORDS);
}

export function matchJob(job: JobData, cv: CvProfile | null, corpus: Corpus): MatchResult {
  const keywords = jobKeywords(job, corpus);
  const words = keywords.map((k) => k.word);
  if (!cv) return { score: null, level: null, keywords: words, matched: [], missing: [] };
  const matched: string[] = [];
  const missing: string[] = [];
  let total = 0;
  let got = 0;
  for (const k of keywords) {
    total += k.weight;
    const has = k.skill ? cvHasSkill(cv, k.word) : cvHasWord(cv, k.word);
    if (has) {
      got += k.weight;
      matched.push(k.word);
    } else missing.push(k.word);
  }
  const titleWords = tokens(job.title).filter((t) => t.length >= 4 && !STOPWORDS.has(t));
  const titleHit = titleWords.length
    ? titleWords.filter((t) => cvHasWord(cv, t)).length / titleWords.length
    : 0;
  if (total === 0 && !titleWords.length) {
    return { score: null, level: null, keywords: words, matched, missing };
  }
  const coverage = total ? got / total : titleHit;
  const score = Math.round(100 * (0.8 * coverage + 0.2 * titleHit));
  return { score, level: levelOf(score), keywords: words, matched, missing };
}

/** Matches every job against the CV (CV empty → keywords only). Keyed by job URL. */
export function matchAll(jobs: JobData[], cvText: string): Map<string, MatchResult> {
  const corpus = buildCorpus(jobs);
  const cv = cvText.trim() ? analyzeCv(cvText) : null;
  return new Map(jobs.map((job) => [job.url, matchJob(job, cv, corpus)]));
}
