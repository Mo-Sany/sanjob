/**
 * SECTION HEADINGS – edit this file to teach Sanjob new headings.
 *
 * The job description is split into these sections using the headings on the page.
 * Matching ignores case, trailing colons and extra spaces. A heading also matches when it
 * contains one of the phrases as whole words (e.g. "Zu deinen Aufgaben gehören:" → tasks),
 * so keep phrases specific enough. Longer phrases win over shorter ones.
 */
export type SectionKey = 'tasks' | 'profile' | 'offer';

export const SECTION_SYNONYMS: Record<SectionKey, string[]> = {
  tasks: [
    'Ihre Aufgaben',
    'Deine Aufgaben',
    'Aufgaben',
    'Ihr Aufgabengebiet',
    'Dein Aufgabengebiet',
    'Das erwartet dich',
    'Das erwartet Sie',
    'Was dich erwartet',
    'Was Sie erwartet',
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
    'Das bringst du mit',
    'Das bringen Sie mit',
    'Was du mitbringst',
    'Was Sie mitbringen',
    'Your profile',
    'Requirements',
    'Qualifications',
    'What you bring',
  ],
  offer: [
    'Wir bieten',
    'Was wir bieten',
    'Das bieten wir',
    'Das bieten wir dir',
    'Das bieten wir Ihnen',
    'Unser Angebot',
    'Benefits',
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

/** Prefix for bullet points inside a section cell. */
export const BULLET = '• ';
