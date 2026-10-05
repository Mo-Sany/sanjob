import type { SitePreset } from '../presets/types';
import { normalizeDate } from '../shared/date';
import { splitSections } from '../sections/split';
import { elementText, htmlToFragment, oneLine } from '../shared/text';
import type { DetailResult, JobCore, JobData, JobHints } from '../shared/types';
import { canonicalJobUrl } from '../shared/url';
import { detectBlock } from './block';
import { firstMatchingElement, readFields } from './fields';
import { genericDescription, genericDescriptionElement } from './generic';
import { findJobPostings, jobFromJsonLd } from './jsonld';

type Fields = JobCore;
const FIELD_NAMES: Array<keyof Fields> = [
  'title',
  'company',
  'location',
  'datePosted',
  'salary',
  'contractType',
  'description',
];

function genericFields(doc: Document): Partial<Fields> {
  const h1 = doc.querySelector('h1');
  const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute('content');
  const time = doc.querySelector('time[datetime]')?.getAttribute('datetime');
  return {
    title: oneLine(h1 ? elementText(h1) : (ogTitle ?? '')),
    datePosted: oneLine(time),
    description: genericDescription(doc),
  };
}

export interface DetailInput {
  doc: Document;
  /** URL of the loaded page (after redirects). */
  pageUrl: string;
  /** URL from the queue; used as the job URL column. */
  jobUrl?: string;
  preset: SitePreset | null;
  hints?: JobHints;
  now?: Date;
}

/**
 * Extracts one job from a detail page.
 * Order per field: JSON-LD → preset selectors → result-card hints.
 * Exception: the description prefers the text rendered on the page (selectors), because it
 * must match the posting as shown; JSON-LD's HTML description is the fallback.
 */
export function extractDetail(input: DetailInput): DetailResult {
  const { doc, pageUrl, preset, hints } = input;
  const posting = findJobPostings(doc)[0];
  const ld: Partial<Fields> = posting ? jobFromJsonLd(posting, doc) : {};
  const sel: Partial<Fields> = preset ? readFields(doc, preset.detail.fields) : genericFields(doc);

  const job: Fields = {
    title: '',
    company: '',
    location: '',
    datePosted: '',
    salary: '',
    contractType: '',
    description: '',
  };
  let usedLd = false;
  let usedSel = false;
  const fromPage = new Set<keyof Fields>();
  let descriptionSource: 'ld' | 'sel' | null = null;
  for (const name of FIELD_NAMES) {
    const order: Array<[string | undefined, 'ld' | 'sel' | 'hint']> =
      name === 'description'
        ? [
            [sel[name], 'sel'],
            [ld[name], 'ld'],
          ]
        : [
            [ld[name], 'ld'],
            [sel[name], 'sel'],
            [hints?.[name as keyof JobHints], 'hint'],
          ];
    for (const [value, src] of order) {
      if (value && value.trim()) {
        job[name] = value.trim();
        if (src === 'ld') usedLd = true;
        if (src === 'sel') usedSel = true;
        if (src !== 'hint') fromPage.add(name);
        if (name === 'description' && src !== 'hint') descriptionSource = src;
        break;
      }
    }
  }
  job.datePosted = normalizeDate(job.datePosted, input.now);

  // The page itself must show a title plus at least one other field (a bare <h1> is not a
  // job). Result-card hints do not count, otherwise a CAPTCHA page would look like a job.
  const hasContent =
    fromPage.has('title') &&
    (fromPage.has('description') || fromPage.has('company') || fromPage.has('location'));
  const block = detectBlock(doc, pageUrl, preset?.block, hasContent);
  if (!hasContent || block) {
    return { job: null, block, source: 'none' };
  }
  // Split the description into sections using the HTML structure it came from.
  let descriptionRoot: Node | null = null;
  if (descriptionSource === 'sel') {
    descriptionRoot = preset
      ? firstMatchingElement(doc, preset.detail.fields.description)
      : genericDescriptionElement(doc);
  } else if (descriptionSource === 'ld' && typeof posting?.['description'] === 'string') {
    descriptionRoot = htmlToFragment(posting['description'], doc);
  }
  const sections = splitSections(descriptionRoot ?? job.description);

  return {
    job: { ...job, ...sections, url: canonicalJobUrl(input.jobUrl ?? pageUrl) },
    block: null,
    source: usedLd && usedSel ? 'mixed' : usedLd ? 'jsonld' : 'selectors',
  };
}

/** True when a job has almost nothing besides a title (used for the window-mode hint). */
export function isMostlyEmpty(job: JobData | null): boolean {
  if (!job) return true;
  const filled = [job.company, job.location, job.description].filter((v) => v.trim()).length;
  return filled === 0 || job.description.trim().length < 40;
}
