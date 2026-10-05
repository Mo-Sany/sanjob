import {
  FILTER_PRESETS,
  activeKeywords,
  excludeMatcher,
  parseKeywords,
} from '../src/shared/filter';
import { excludeKeywordsOf, sanitizeSettings } from '../src/shared/settings';

describe('title filter', () => {
  const school = excludeMatcher(['Schüler', 'Schul', 'Ferial']);

  it.each([
    ['Schülerpraktikum Elektrotechnik', 'Schüler'],
    ['Praktikum für SCHÜLER (m/w/d)', 'Schüler'],
    ['Schulbegleiter (m/w/d)', 'Schul'],
    ['Ferialpraktikum Sommer 2027', 'Ferial'],
    ['Ferialjob – Lager', 'Ferial'],
  ])('excludes "%s"', (title, word) => {
    expect(school(title)).toBe(word);
  });

  it.each([
    'Praktikum Mechatronik',
    'Hochschulabsolvent Automatisierung',
    'Werkstudent Elektrotechnik',
  ])('keeps "%s"', (title) => {
    expect(school(title)).toBeNull();
  });

  it('Praxissemester preset', () => {
    const preset = FILTER_PRESETS.find((p) => p.id === 'praxissemester')!;
    expect(preset.keywords).toEqual([
      'Dual',
      'Studiengang',
      'Quereinsteiger',
      'Senior',
      'Schüler',
      'Controlling',
      'Ausbildung',
    ]);
    const m = excludeMatcher(preset.keywords);
    expect(m('Duales Studium Elektrotechnik')).toBe('Dual');
    expect(m('Senior Automation Engineer')).toBe('Senior');
    expect(m('Ausbildung zum Mechatroniker')).toBe('Ausbildung');
    expect(m('Praktikum im Controlling')).toBe('Controlling');
    expect(m('Quereinsteiger Lager')).toBe('Quereinsteiger');
    expect(m('Praxissemester Automatisierungstechnik')).toBeNull();
    expect(m('Pflichtpraktikum / Praxissemester Mechatronik')).toBeNull();
  });

  it('settings choose the active words', () => {
    expect(excludeKeywordsOf(sanitizeSettings({}))).toEqual(['Schüler', 'Schul', 'Ferial']);
    expect(excludeKeywordsOf(sanitizeSettings({ filterPreset: 'praxissemester' }))).toContain(
      'Dual',
    );
    expect(excludeKeywordsOf(sanitizeSettings({ filterPreset: 'off' }))).toEqual([]);
    expect(
      excludeKeywordsOf(sanitizeSettings({ filterPreset: 'custom', excludeKeywords: ['Minijob'] })),
    ).toEqual(['Minijob']);
    expect(activeKeywords('custom', [])).toEqual([]);
    expect(parseKeywords('Dual, Senior;  Senior\nAusbildung')).toEqual([
      'Dual',
      'Senior',
      'Ausbildung',
    ]);
  });
});
