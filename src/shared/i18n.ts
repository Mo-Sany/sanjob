/**
 * All user-visible text (English + German).
 * Rule: no technical words ("error", "failed", codes) – every message says what happens next
 * or what the user can do. Technical details go to the console / the hidden "Details" toggle.
 */
import type { Language } from './types';

const en = {
  appTagline: 'Collect jobs into one table',
  settings: 'Settings',
  back: 'Back',
  details: 'Details',
  hideDetails: 'Hide details',
  dismiss: 'Dismiss',

  // Page analysis
  analyzing: 'Reading this page…',
  siteDetected: '{site} detected',
  otherSite: 'Job list found',
  jobsOnPage: '{n} jobs on this page',
  totalJobs: 'about {n} jobs in total',
  pagesCount: '{n} pages',
  onePage: '1 page',
  estimate: 'Estimated time: ~{t}',
  alreadyCollected: '{n} already collected, will be skipped',
  pagesToCollect: 'Result pages to collect',
  startCollecting: 'Start collecting',
  onlyThisPage: 'Only this page',
  chooseManually: 'Choose list manually',
  smartDetection: 'Smart detection',
  manualList: 'Your selected list',
  resetList: 'Use automatic detection',
  notJobList:
    "This doesn't look like a job list. Open a search results page or pick a list manually.",
  notWeb: 'Open a job search results page in this window – Sanjob reads it automatically.',
  needAccess: 'Sanjob needs your permission to read {site}.',
  allowAccess: 'Allow and read page',
  accessDenied: 'No problem – without permission Sanjob leaves this site alone.',
  pickerHint: 'Point at the job list on the page and click it. Esc cancels.',
  pickerPicked: 'Got it – list with {n} items selected.',
  pickerNothing: "That didn't look like a list. Try pointing at a single job card.",
  reload: 'Read again',

  // Progress
  status: {
    idle: 'Ready',
    running: 'Collecting',
    paused: 'Paused',
    blocked: 'Waiting for you',
    interrupted: 'Interrupted',
    done: 'Finished',
    error: 'Paused',
  },
  findingJobs: 'Finding jobs on result page {n}…',
  readingJobs: 'Reading job {n} of {total}',
  reading: 'Now reading',
  collected: 'Collected',
  skippedSaved: 'Already saved',
  unreadable: "Couldn't read",
  timeLeft: '~{t} left',
  pause: 'Pause',
  continue: 'Continue',
  stop: 'Stop',
  confirmStop: 'Stop this collection? The jobs collected so far are kept.',
  interruptedNotice: 'Your last collection was interrupted. Continue where it stopped?',
  notices: {
    retrying: 'This page is taking a while – trying again…',
    skipped: "Skipped 1 job that couldn't be read. Continuing…",
    nothingFound: 'No jobs found here yet. Try scrolling or choose the list manually.',
    noResponse: "The page didn't respond. Check your connection, then click Continue.",
  },
  blocked: {
    captcha:
      "{site} wants you to confirm you're human. Solve it in the window, then click Continue.",
    login: '{site} asks you to log in. Log in in the window, then click Continue.',
    blocked: "{site} isn't letting us in right now. Wait a moment, then click Continue.",
  },
  windowHint:
    'Some job pages came back almost empty. This site may need a visible window. Switch to a small window?',
  switchWindow: 'Use small window',
  keepRunning: 'You can switch tabs – Sanjob keeps collecting in its own window.',

  // Summary
  summaryTitle: 'All done 🎉',
  summaryEmpty: 'Finished – no new jobs this time.',
  summaryLine: '{c} collected · {s} skipped (already saved) · {u} unreadable',
  downloadExcel: 'Download Excel',
  openTable: 'Open table',
  newCollection: 'New collection',

  // Table
  table: 'Collected jobs',
  search: 'Search…',
  selectAll: 'Select all',
  deleteSelected: 'Delete selected',
  deleteRow: 'Delete',
  deleted: 'Deleted {n} jobs',
  matchSelected: 'Match with my CV',
  copyPrompt: 'Copy CV match prompt',
  promptCopied: 'Prompt copied – paste it into claude.ai ✨',
  copyBlocked: "Couldn't copy to the clipboard – click into the panel and try again.",
  needCv: 'Add your CV text in Settings first.',
  selectJobsFirst: 'Select at least one job.',
  export: 'Export Excel',
  appendPrevious: 'Append to previous results',
  appendHint: 'On: all stored jobs. Off: only the latest collection.',
  exported: 'Excel exported 🎉',
  nothingToExport: 'Nothing to export yet – collect some jobs first.',
  noJobs: 'No jobs yet',
  noJobsHint: 'Open a job search and click "Start collecting". Your jobs appear here.',
  noMatches: 'No jobs match your search.',
  columns: {
    title: 'Title',
    company: 'Company',
    location: 'Location',
    datePosted: 'Date posted',
    salary: 'Salary',
    contractType: 'Contract type',
    url: 'URL',
    description: 'Description',
    tasks: 'Your tasks',
    profile: 'Your profile',
    offer: 'We offer',
    other: 'Other',
  },

  // Settings
  language: 'Language',
  delay: 'Pause between page loads (seconds)',
  delayMin: 'min',
  delayMax: 'max',
  maxPages: 'Default number of result pages',
  windowMode: 'Collection window',
  windowMinimized: 'Minimized (default)',
  windowNormal: 'Small normal window',
  cv: 'Your CV / skills (stored only in this browser)',
  cvPlaceholder: 'Paste your CV or a list of your skills…',
  history: 'Duplicate history',
  historyCount: '{n} job URLs remembered',
  clearHistory: 'Clear history',
  historyCleared: 'History cleared',
  saved: 'Saved ✓',
  privacy:
    'Sanjob stores everything locally in your browser. No telemetry, no analytics, no servers. Please respect each site’s Terms of Service.',
  confirmClearHistory:
    'Forget all collected job URLs? Jobs already collected may be collected again.',
  confirmDelete: 'Delete {n} selected jobs?',

  // Problems (friendly)
  problems: {
    busy: 'A collection is already running – pause or stop it first.',
    window: "Couldn't open the collection window. Please try again.",
    unknown: 'Something got in the way – please try again.',
  },
};

export type Strings = typeof en;

const de: Strings = {
  appTagline: 'Jobs in einer Tabelle sammeln',
  settings: 'Einstellungen',
  back: 'Zurück',
  details: 'Details',
  hideDetails: 'Details ausblenden',
  dismiss: 'Ausblenden',

  analyzing: 'Seite wird gelesen…',
  siteDetected: '{site} erkannt',
  otherSite: 'Jobliste gefunden',
  jobsOnPage: '{n} Jobs auf dieser Seite',
  totalJobs: 'ca. {n} Jobs insgesamt',
  pagesCount: '{n} Seiten',
  onePage: '1 Seite',
  estimate: 'Geschätzte Dauer: ~{t}',
  alreadyCollected: '{n} bereits gesammelt, werden übersprungen',
  pagesToCollect: 'Ergebnisseiten sammeln',
  startCollecting: 'Sammeln starten',
  onlyThisPage: 'Nur diese Seite',
  chooseManually: 'Liste selbst wählen',
  smartDetection: 'Intelligente Erkennung',
  manualList: 'Deine gewählte Liste',
  resetList: 'Automatisch erkennen',
  notJobList:
    'Das sieht nicht nach einer Jobliste aus. Öffne eine Suchergebnisseite oder wähle die Liste selbst.',
  notWeb:
    'Öffne in diesem Fenster eine Ergebnisseite einer Jobsuche – Sanjob liest sie automatisch.',
  needAccess: 'Sanjob braucht deine Erlaubnis, um {site} zu lesen.',
  allowAccess: 'Erlauben und Seite lesen',
  accessDenied: 'Kein Problem – ohne Erlaubnis lässt Sanjob diese Seite in Ruhe.',
  pickerHint: 'Zeige auf der Seite auf die Jobliste und klicke sie an. Esc bricht ab.',
  pickerPicked: 'Alles klar – Liste mit {n} Einträgen ausgewählt.',
  pickerNothing: 'Das sah nicht nach einer Liste aus. Zeige auf eine einzelne Stellenkarte.',
  reload: 'Neu lesen',

  status: {
    idle: 'Bereit',
    running: 'Sammelt',
    paused: 'Pausiert',
    blocked: 'Wartet auf dich',
    interrupted: 'Unterbrochen',
    done: 'Fertig',
    error: 'Pausiert',
  },
  findingJobs: 'Suche Jobs auf Ergebnisseite {n}…',
  readingJobs: 'Lese Job {n} von {total}',
  reading: 'Gerade',
  collected: 'Gesammelt',
  skippedSaved: 'Schon gespeichert',
  unreadable: 'Nicht lesbar',
  timeLeft: 'noch ~{t}',
  pause: 'Pause',
  continue: 'Weiter',
  stop: 'Stoppen',
  confirmStop: 'Sammlung stoppen? Die bisher gesammelten Jobs bleiben erhalten.',
  interruptedNotice:
    'Die letzte Sammlung wurde unterbrochen. Dort weitermachen, wo sie aufgehört hat?',
  notices: {
    retrying: 'Diese Seite braucht etwas länger – neuer Versuch…',
    skipped: '1 Job konnte nicht gelesen werden und wurde übersprungen. Es geht weiter…',
    nothingFound:
      'Hier wurden noch keine Jobs gefunden. Scrolle etwas oder wähle die Liste selbst.',
    noResponse:
      'Die Seite hat nicht geantwortet. Prüfe deine Verbindung und klicke dann auf Weiter.',
  },
  blocked: {
    captcha:
      '{site} möchte bestätigen, dass du ein Mensch bist. Löse die Abfrage im Fenster und klicke dann auf Weiter.',
    login:
      '{site} möchte, dass du dich anmeldest. Melde dich im Fenster an und klicke dann auf Weiter.',
    blocked: '{site} lässt uns gerade nicht hinein. Warte kurz und klicke dann auf Weiter.',
  },
  windowHint:
    'Einige Stellenseiten waren fast leer. Diese Seite braucht vielleicht ein sichtbares Fenster. Zu einem kleinen Fenster wechseln?',
  switchWindow: 'Kleines Fenster nutzen',
  keepRunning: 'Du kannst die Tabs wechseln – Sanjob sammelt in seinem eigenen Fenster weiter.',

  summaryTitle: 'Fertig 🎉',
  summaryEmpty: 'Fertig – diesmal keine neuen Jobs.',
  summaryLine: '{c} gesammelt · {s} übersprungen (schon gespeichert) · {u} nicht lesbar',
  downloadExcel: 'Excel herunterladen',
  openTable: 'Tabelle öffnen',
  newCollection: 'Neue Sammlung',

  table: 'Gesammelte Jobs',
  search: 'Suchen…',
  selectAll: 'Alle auswählen',
  deleteSelected: 'Auswahl löschen',
  deleteRow: 'Löschen',
  deleted: '{n} Jobs gelöscht',
  matchSelected: 'Mit meinem Lebenslauf abgleichen',
  copyPrompt: 'Lebenslauf-Abgleich-Prompt kopieren',
  promptCopied: 'Prompt kopiert – füge ihn auf claude.ai ein ✨',
  copyBlocked:
    'Kopieren in die Zwischenablage ging nicht – klicke in den Seitenbereich und versuche es erneut.',
  needCv: 'Füge zuerst deinen Lebenslauf in den Einstellungen ein.',
  selectJobsFirst: 'Wähle mindestens einen Job aus.',
  export: 'Excel exportieren',
  appendPrevious: 'An frühere Ergebnisse anhängen',
  appendHint: 'An: alle gespeicherten Jobs. Aus: nur die letzte Sammlung.',
  exported: 'Excel exportiert 🎉',
  nothingToExport: 'Noch nichts zu exportieren – sammle zuerst ein paar Jobs.',
  noJobs: 'Noch keine Jobs',
  noJobsHint: 'Öffne eine Jobsuche und klicke auf „Sammeln starten“. Deine Jobs erscheinen hier.',
  noMatches: 'Keine Jobs passen zu deiner Suche.',
  columns: {
    title: 'Titel',
    company: 'Unternehmen',
    location: 'Ort',
    datePosted: 'Veröffentlicht',
    salary: 'Gehalt',
    contractType: 'Vertragsart',
    url: 'URL',
    description: 'Beschreibung',
    tasks: 'Ihre Aufgaben',
    profile: 'Ihr Profil',
    offer: 'Wir bieten',
    other: 'Sonstiges',
  },

  language: 'Sprache',
  delay: 'Pause zwischen Seitenaufrufen (Sekunden)',
  delayMin: 'min',
  delayMax: 'max',
  maxPages: 'Standardanzahl Ergebnisseiten',
  windowMode: 'Sammel-Fenster',
  windowMinimized: 'Minimiert (Standard)',
  windowNormal: 'Kleines normales Fenster',
  cv: 'Dein Lebenslauf / Fähigkeiten (nur in diesem Browser gespeichert)',
  cvPlaceholder: 'Lebenslauf oder Liste deiner Fähigkeiten einfügen…',
  history: 'Duplikat-Verlauf',
  historyCount: '{n} Job-URLs gespeichert',
  clearHistory: 'Verlauf löschen',
  historyCleared: 'Verlauf gelöscht',
  saved: 'Gespeichert ✓',
  privacy:
    'Sanjob speichert alles lokal in deinem Browser. Keine Telemetrie, keine Analyse, keine Server. Bitte beachte die Nutzungsbedingungen der jeweiligen Seite.',
  confirmClearHistory:
    'Alle gesammelten Job-URLs vergessen? Bereits gesammelte Jobs können dann erneut gesammelt werden.',
  confirmDelete: '{n} ausgewählte Jobs löschen?',

  problems: {
    busy: 'Es läuft bereits eine Sammlung – pausiere oder stoppe sie zuerst.',
    window: 'Das Sammel-Fenster ließ sich nicht öffnen. Bitte versuche es noch einmal.',
    unknown: 'Da kam etwas dazwischen – bitte versuche es noch einmal.',
  },
};

export const STRINGS: Record<Language, Strings> = { en, de };

export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_m, k: string) => String(vars[k] ?? ''));
}

/** "~30 min", "45 s", "2 h 10 min" */
export function formatDuration(seconds: number, lang: Language): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60)
    return lang === 'de'
      ? `${Math.max(5, Math.round(s / 5) * 5)} Sek.`
      : `${Math.max(5, Math.round(s / 5) * 5)} s`;
  const min = Math.round(s / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const rest = min % 60;
  const hLabel = lang === 'de' ? 'Std.' : 'h';
  return rest ? `${h} ${hLabel} ${rest} min` : `${h} ${hLabel}`;
}

export function formatNumber(n: number, lang: Language): string {
  return n.toLocaleString(lang === 'de' ? 'de-DE' : 'en-US');
}
