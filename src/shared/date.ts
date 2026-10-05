const pad = (n: number): string => String(n).padStart(2, '0');

export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const MONTHS: Record<string, number> = {
  jan: 1,
  januar: 1,
  january: 1,
  jänner: 1,
  feb: 2,
  februar: 2,
  february: 2,
  mär: 3,
  mar: 3,
  märz: 3,
  maerz: 3,
  march: 3,
  apr: 4,
  april: 4,
  mai: 5,
  may: 5,
  jun: 6,
  juni: 6,
  june: 6,
  jul: 7,
  juli: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  okt: 10,
  oct: 10,
  oktober: 10,
  october: 10,
  nov: 11,
  november: 11,
  dez: 12,
  dec: 12,
  dezember: 12,
  december: 12,
};

type Unit = 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year';
const UNIT_PATTERNS: Array<[RegExp, Unit]> = [
  [/^(min|minute|minuten|minutes|mins?)$/, 'minute'],
  [/^(std|stunde|stunden|hour|hours|hrs?|h)$/, 'hour'],
  [/^(tag|tagen|tage|day|days|d)$/, 'day'],
  [/^(woche|wochen|week|weeks|wk|wks)$/, 'week'],
  [/^(monat|monaten|monate|month|months|mo)$/, 'month'],
  [/^(jahr|jahren|jahre|year|years|yr|yrs)$/, 'year'],
];

const WORD_NUMBERS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  einem: 1,
  einer: 1,
  einen: 1,
  ein: 1,
  eine: 1,
  two: 2,
  zwei: 2,
  three: 3,
  drei: 3,
  four: 4,
  vier: 4,
  five: 5,
  fünf: 5,
  six: 6,
  sechs: 6,
  seven: 7,
  sieben: 7,
};

function unitOf(word: string): Unit | null {
  for (const [re, unit] of UNIT_PATTERNS) if (re.test(word)) return unit;
  return null;
}

function shift(now: Date, amount: number, unit: Unit): Date {
  const d = new Date(now.getTime());
  switch (unit) {
    case 'minute':
      d.setMinutes(d.getMinutes() - amount);
      break;
    case 'hour':
      d.setHours(d.getHours() - amount);
      break;
    case 'day':
      d.setDate(d.getDate() - amount);
      break;
    case 'week':
      d.setDate(d.getDate() - amount * 7);
      break;
    case 'month':
      d.setMonth(d.getMonth() - amount);
      break;
    case 'year':
      d.setFullYear(d.getFullYear() - amount);
      break;
  }
  return d;
}

function validYmd(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(y, m - 1, d);
  if (date.getMonth() !== m - 1) return null;
  return toIsoDate(date);
}

/**
 * Normalizes a "date posted" text to ISO YYYY-MM-DD.
 * Handles ISO timestamps, German/English absolute dates and relative dates such as
 * "vor 3 Tagen", "Heute", "Gestern", "2 days ago", "Posted 1 week ago".
 * Returns the trimmed raw text when the date cannot be parsed reliably
 * (e.g. "30+ days ago", which has no exact date).
 */
export function normalizeDate(raw: string | null | undefined, now: Date = new Date()): string {
  const text = (raw ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  const s = text.toLowerCase();

  // ISO date or timestamp: 2026-09-30, 2026-09-30T10:00:00Z
  const iso = s.match(
    /\b(\d{4})-(\d{2})-(\d{2})(?:[t ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(z|[+-]\d{2}:?\d{2})?)?\b/,
  );
  if (iso) {
    if (iso[4] && iso[7]) {
      const d = new Date(text.slice(iso.index ?? 0).split(/\s/)[0] ?? '');
      if (!Number.isNaN(d.getTime())) return toIsoDate(d);
    }
    const r = validYmd(Number(iso[1]), Number(iso[2]), Number(iso[3]));
    if (r) return r;
  }

  // "30+ days" / "mehr als 30 Tagen" – no exact date: keep raw
  if (/\d+\s*\+/.test(s) || /mehr als|more than|über \d/.test(s)) return text;

  // German numeric: 30.09.2026 or 30.09.26
  const de = s.match(/\b(\d{1,2})\.(\d{1,2})\.(\d{2,4})\b/);
  if (de) {
    let y = Number(de[3]);
    if (y < 100) y += 2000;
    const r = validYmd(y, Number(de[2]), Number(de[1]));
    if (r) return r;
  }

  // "30. September 2026", "30 Sep 2026", "30. Sept. 2026"
  const dmy = s.match(/\b(\d{1,2})\.?\s+([a-zäöü]{3,10})\.?,?\s+(\d{4})\b/);
  if (dmy && MONTHS[dmy[2] ?? ''] !== undefined) {
    const r = validYmd(Number(dmy[3]), MONTHS[dmy[2] ?? ''] ?? 0, Number(dmy[1]));
    if (r) return r;
  }
  // "September 30, 2026", "Sep 30 2026"
  const mdy = s.match(/\b([a-zäöü]{3,10})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/);
  if (mdy && MONTHS[mdy[1] ?? ''] !== undefined) {
    const r = validYmd(Number(mdy[3]), MONTHS[mdy[1] ?? ''] ?? 0, Number(mdy[2]));
    if (r) return r;
  }

  // Today / yesterday
  if (
    /\b(heute|today|just posted|gerade (eben )?(veröffentlicht|geschaltet)|soeben|jetzt|just now|neu|new)\b/.test(
      s,
    )
  ) {
    if (!/\d/.test(s)) return toIsoDate(now);
  }
  if (/\bvorgestern\b/.test(s)) return toIsoDate(shift(now, 2, 'day'));
  if (/\b(gestern|yesterday)\b/.test(s)) return toIsoDate(shift(now, 1, 'day'));

  // Relative: "vor 3 Tagen", "vor einer Woche", "2 days ago", "Posted an hour ago"
  const rel =
    s.match(/\bvor\s+(\d+|[a-zäöü]+)\s+([a-zäöü]+)/) ??
    s.match(/\b(\d+|an?|one|two|three|four|five|six|seven)\s+([a-z]+)\s+ago\b/) ??
    s.match(/\b(\d+)\s*(min|h|d|w|mo|yr)\b/);
  if (rel) {
    const amountWord = rel[1] ?? '';
    const amount = /^\d+$/.test(amountWord) ? Number(amountWord) : WORD_NUMBERS[amountWord];
    const unit = unitOf(rel[2] ?? '');
    if (amount !== undefined && unit) return toIsoDate(shift(now, amount, unit));
  }

  return text;
}
