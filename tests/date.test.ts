import { normalizeDate } from '../src/shared/date';

// Fixed "now": Monday 2026-10-05, 14:00 local time.
const now = new Date(2026, 9, 5, 14, 0, 0);

describe('normalizeDate', () => {
  it.each([
    ['Heute', '2026-10-05'],
    ['heute geschaltet', '2026-10-05'],
    ['Today', '2026-10-05'],
    ['Just posted', '2026-10-05'],
    ['Gestern', '2026-10-04'],
    ['yesterday', '2026-10-04'],
    ['vor 3 Tagen', '2026-10-02'],
    ['Vor 3 Tagen geschaltet', '2026-10-02'],
    ['vor einem Tag', '2026-10-04'],
    ['vor 2 Wochen', '2026-09-21'],
    ['vor 1 Monat', '2026-09-05'],
    ['vor 5 Stunden', '2026-10-05'],
    ['2 days ago', '2026-10-03'],
    ['Posted 3 days ago', '2026-10-02'],
    ['Reposted 1 week ago', '2026-09-28'],
    ['an hour ago', '2026-10-05'],
    ['3 months ago', '2026-07-05'],
    ['2026-09-30', '2026-09-30'],
    ['2026-09-30T08:00:00', '2026-09-30'],
    ['30.09.2026', '2026-09-30'],
    ['1.9.26', '2026-09-01'],
    ['30. September 2026', '2026-09-30'],
    ['3. März 2026', '2026-03-03'],
    ['September 30, 2026', '2026-09-30'],
    ['30 Sep 2026', '2026-09-30'],
  ])('%s → %s', (raw, expected) => {
    expect(normalizeDate(raw, now)).toBe(expected);
  });

  it('keeps the raw text when no exact date exists', () => {
    expect(normalizeDate('30+ days ago', now)).toBe('30+ days ago');
    expect(normalizeDate('Vor mehr als 30 Tagen', now)).toBe('Vor mehr als 30 Tagen');
    expect(normalizeDate('Promoted', now)).toBe('Promoted');
    expect(normalizeDate('31.02.2026', now)).toBe('31.02.2026');
  });

  it('returns empty string for empty input', () => {
    expect(normalizeDate('', now)).toBe('');
    expect(normalizeDate(undefined, now)).toBe('');
  });
});
