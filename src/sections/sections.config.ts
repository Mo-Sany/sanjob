/**
 * SECTION HEADINGS – edit this file to teach Sanjob new headings.
 *
 * The job description is split into these sections using the headings on the page.
 * Matching ignores case, trailing colons and extra spaces. A line is a heading when it is
 * short (≤ 60 characters) and either equals one of the phrases, or ends with ":" / "?" (or is
 * an HTML heading / bold line) and contains a phrase as whole words
 * (e.g. "Zu deinen Aufgaben gehören:" → tasks). Longer phrases win over shorter ones.
 */
export type SectionKey = 'tasks' | 'profile' | 'offer';

export const SECTION_SYNONYMS: Record<SectionKey, string[]> = {
  tasks: [
    'Ihre Aufgaben',
    'Deine Aufgaben',
    'Aufgaben',
    'Dein Job',
    'Ihr Job',
    'Ihr Aufgabengebiet',
    'Ihr zukünftiges Aufgabengebiet',
    'Aufgabengebiet',
    'Dein Aufgabengebiet',
    'Das erwartet dich',
    'Das erwartet Sie',
    'Was dich erwartet',
    'Was Sie erwartet',
    'Was du tust',
    'Was Sie tun',
    'Deine Tätigkeiten',
    'Ihre Tätigkeiten',
    'Your tasks',
    'Your responsibilities',
    'Responsibilities',
    'What you will do',
    "What you'll do",
  ],
  profile: [
    'Ihr Profil',
    'Dein Profil',
    'Profil',
    'Anforderungen',
    'Qualifikationen',
    'Ihre Qualifikationen',
    'Deine Qualifikationen',
    'Das bringst du mit',
    'Das bringen Sie mit',
    'Diese Skills bringst du mit',
    'Was du mitbringst',
    'Was Sie mitbringen',
    'Your profile',
    'Requirements',
    'Qualifications',
    'What you bring',
  ],
  offer: [
    'Wir bieten',
    'Wir bieten Ihnen',
    'Wir bieten dir',
    'Was wir bieten',
    'Das bieten wir',
    'Das bieten wir dir',
    'Das bieten wir Ihnen',
    'Unser Angebot',
    'Benefits',
    'Deine Benefits',
    'Ihre Benefits',
    'Deine Vorteile',
    'Ihre Vorteile',
    'Darauf kannst du dich freuen',
    'Darauf können Sie sich freuen',
    'Warum wir',
    'Gute Gründe',
    'richtige Arbeitgeber',
    'What we offer',
    'Why us',
    'Why join us',
    'Perks',
  ],
};

/**
 * Weak headings: only used when the posting has no other heading for that section
 * ("Stellenbeschreibung" often introduces the whole ad, not the tasks).
 */
export const WEAK_SYNONYMS: Record<SectionKey, string[]> = {
  tasks: ['Stellenbeschreibung'],
  profile: [],
  offer: [],
};

/**
 * Footer markers: a line starting with one of these ends the current section; it and
 * everything after it goes to "Sonstiges" (until the next known heading).
 * Lines with an e-mail address, a German postal code + city or "Jetzt … bewerben" are footer
 * lines, too.
 */
export const FOOTER_MARKERS: string[] = [
  'Wir freuen uns über',
  'Wir freuen uns auf deine Bewerbung',
  'Wir freuen uns auf Ihre Bewerbung',
  'Ihre Bewerbung',
  'Deine Bewerbung',
  'Kontakt',
  'Ansprechpartner',
  'Ansprechpartnerin',
  'Noch Fragen',
  'Sie haben noch Fragen',
  'Haben Sie Fragen',
  'Hast du Fragen',
  'So geht es weiter',
  'Haben wir Dein Interesse geweckt',
  'Haben wir Ihr Interesse geweckt',
  'FAQ',
  'Jetzt bewerben',
  'Bewirb dich jetzt',
  "So geht's",
  'Der Bewerbungsprozess',
  'Bewerbungsprozess',
];

/** Prefix for bullet points inside a section cell. */
export const BULLET = '• ';
