/**
 * Title filter: skip jobs whose title contains an excluded word, e.g. "Schülerpraktikum".
 * A keyword matches at the START of a word (case-insensitive): "Schul" matches "Schulbegleiter"
 * and "Schul-Praktikum" but not "Hochschulabsolvent".
 */
export const DEFAULT_EXCLUDE = ['Schüler', 'Schul', 'Ferial'];

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function parseKeywords(text: string): string[] {
  return [
    ...new Set(
      text
        .split(/[,;\n]/)
        .map((k) => k.trim())
        .filter(Boolean),
    ),
  ];
}

export function excludeMatcher(keywords: string[]): (title: string | undefined) => string | null {
  const list = keywords.map((k) => k.trim()).filter(Boolean);
  if (!list.length) return () => null;
  const res = list.map((k) => ({ k, re: new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRe(k)}`, 'iu') }));
  return (title) => {
    if (!title) return null;
    return res.find(({ re }) => re.test(title))?.k ?? null;
  };
}

export type FilterPresetId = 'school' | 'praxissemester' | 'custom' | 'off';

/** Ready-made title filters (Settings → Filter). */
export const FILTER_PRESETS: Array<{
  id: Exclude<FilterPresetId, 'custom' | 'off'>;
  name: { en: string; de: string };
  keywords: string[];
}> = [
  {
    id: 'school',
    name: { en: 'Pupils & holiday jobs', de: 'Schüler & Ferialjobs' },
    keywords: DEFAULT_EXCLUDE,
  },
  {
    id: 'praxissemester',
    name: { en: 'Praxissemester', de: 'Praxissemester' },
    keywords: [
      'Dual',
      'Studiengang',
      'Quereinsteiger',
      'Senior',
      'Schüler',
      'Controlling',
      'Ausbildung',
    ],
  },
];

/** The keywords that are active for a preset choice (custom = the user's own list). */
export function activeKeywords(preset: FilterPresetId, custom: string[]): string[] {
  if (preset === 'off') return [];
  if (preset === 'custom') return custom;
  return FILTER_PRESETS.find((p) => p.id === preset)?.keywords ?? custom;
}
