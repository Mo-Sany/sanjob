import type { JobData } from '../shared/types';
import { htmlToText, oneLine } from '../shared/text';

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type JsonObject = { [key: string]: Json };

const isObj = (v: Json | undefined): v is JsonObject =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const asArray = (v: Json | undefined): Json[] =>
  v === undefined || v === null ? [] : Array.isArray(v) ? v : [v];

const str = (v: Json | undefined): string => {
  if (typeof v === 'string') return oneLine(v);
  if (typeof v === 'number') return String(v);
  if (isObj(v)) return str(v['name'] ?? v['@value'] ?? v['value']);
  return '';
};

function isJobPosting(o: JsonObject): boolean {
  return asArray(o['@type']).some(
    (t) => typeof t === 'string' && /^(schema:)?JobPosting$/i.test(t),
  );
}

/** Finds all schema.org JobPosting objects in <script type="application/ld+json"> blocks. */
export function findJobPostings(doc: Document): JsonObject[] {
  const found: JsonObject[] = [];
  const visit = (v: Json, depth: number): void => {
    if (depth > 6) return;
    if (Array.isArray(v)) {
      for (const x of v) visit(x, depth + 1);
      return;
    }
    if (!isObj(v)) return;
    if (isJobPosting(v)) {
      found.push(v);
      return;
    }
    for (const key of ['@graph', 'mainEntity', 'itemListElement', 'item']) {
      if (v[key] !== undefined) visit(v[key] as Json, depth + 1);
    }
  };
  for (const script of Array.from(doc.querySelectorAll('script[type="application/ld+json"]'))) {
    const raw = (script.textContent ?? '').trim();
    if (!raw) continue;
    try {
      visit(JSON.parse(raw) as Json, 0);
    } catch {
      // Some sites emit invalid JSON (e.g. raw newlines in strings). Try a lenient pass.
      try {
        // eslint-disable-next-line no-control-regex
        visit(JSON.parse(raw.replace(/[\u0000-\u001f]+/g, ' ')) as Json, 0);
      } catch {
        /* ignore broken block */
      }
    }
  }
  return found;
}

function formatLocation(job: JsonObject): string {
  const parts: string[] = [];
  for (const loc of asArray(job['jobLocation'])) {
    if (!isObj(loc)) {
      const s = str(loc);
      if (s) parts.push(s);
      continue;
    }
    const addr = loc['address'];
    if (isObj(addr)) {
      const city = str(addr['addressLocality']);
      const pieces = [
        [str(addr['postalCode']), city].filter(Boolean).join(' '),
        str(addr['addressRegion']) !== city ? str(addr['addressRegion']) : '',
        str(addr['addressCountry']),
      ].filter(Boolean);
      const text = pieces.join(', ') || str(addr['streetAddress']);
      if (text) parts.push(text);
    } else if (typeof addr === 'string' && addr.trim()) {
      parts.push(oneLine(addr));
    } else if (str(loc['name'])) {
      parts.push(str(loc['name']));
    }
  }
  if (asArray(job['jobLocationType']).some((t) => /telecommute/i.test(str(t)))) {
    parts.push('Remote');
  }
  return [...new Set(parts)].join('; ');
}

function formatNumber(n: Json | undefined): string {
  if (typeof n === 'number') return n.toLocaleString('de-DE');
  if (typeof n === 'string' && n.trim() && !Number.isNaN(Number(n))) {
    return Number(n).toLocaleString('de-DE');
  }
  return typeof n === 'string' ? n.trim() : '';
}

function formatSalary(job: JsonObject): string {
  const salary = job['baseSalary'] ?? job['estimatedSalary'];
  const first = asArray(salary)[0];
  if (first === undefined) return '';
  if (!isObj(first)) return str(first);
  const currency = str(first['currency']) || str(first['salaryCurrency']);
  const value = first['value'];
  let amount: string;
  let unit = str(first['unitText']);
  if (isObj(value)) {
    const min = formatNumber(value['minValue']);
    const max = formatNumber(value['maxValue']);
    const single = formatNumber(value['value']);
    amount = min && max && min !== max ? `${min}–${max}` : min || max || single;
    unit = str(value['unitText']) || unit;
  } else {
    amount = formatNumber(value);
  }
  if (!amount) return '';
  return [amount, currency, unit ? `/ ${unit}` : ''].filter(Boolean).join(' ');
}

const EMPLOYMENT_TYPES: Record<string, string> = {
  FULL_TIME: 'Full-time',
  PART_TIME: 'Part-time',
  CONTRACTOR: 'Contractor',
  TEMPORARY: 'Temporary',
  INTERN: 'Internship',
  VOLUNTEER: 'Volunteer',
  PER_DIEM: 'Per diem',
  OTHER: 'Other',
};

function formatEmployment(job: JsonObject): string {
  return asArray(job['employmentType'])
    .flatMap((t) => str(t).split(/\s*,\s*/))
    .filter(Boolean)
    .map((t) => EMPLOYMENT_TYPES[t.toUpperCase().replace(/[- ]/g, '_')] ?? t)
    .filter((t, i, arr) => arr.indexOf(t) === i)
    .join(', ');
}

/** Maps a JobPosting object to our columns. Missing values stay ''. */
export function jobFromJsonLd(job: JsonObject, doc: Document): Omit<JobData, 'url'> {
  const org = asArray(job['hiringOrganization'])[0];
  return {
    title: str(job['title']) || str(job['name']),
    company: org === undefined ? '' : str(org),
    location: formatLocation(job),
    datePosted: str(job['datePosted']),
    salary: formatSalary(job),
    contractType: formatEmployment(job),
    description: typeof job['description'] === 'string' ? htmlToText(job['description'], doc) : '',
  };
}
