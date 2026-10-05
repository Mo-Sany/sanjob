/**
 * SITE PRESETS – edit this file when a job board changes its HTML.
 *
 * Each preset tells Sanjob where to find job links on a results page, how to reach the next
 * page and where each field lives on a job detail page. Every field has a list of rules that
 * are tried in order; the first rule that yields a value wins. Structured data
 * (schema.org JobPosting JSON-LD) is always preferred when a page provides it – these
 * selectors are the fallback.
 *
 * See README → "Fixing a site preset" for a step-by-step guide.
 */
import type { SitePreset } from './types';

/** Text that looks like a salary. */
export const SALARY_RE =
  '€|\\$|£|\\bCHF\\b|\\bEUR\\b|\\bUSD\\b|pro (Stunde|Monat|Jahr|Tag)|per (hour|month|year|annum|day)|\\b(Gehalt|salary)\\b';
/** Text that looks like an employment / contract type. */
export const CONTRACT_RE =
  'Vollzeit|Teilzeit|Full[- ]time|Part[- ]time|Minijob|Praktikum|Internship|Werkstudent|Working student|Befristet|Unbefristet|Festanstellung|Feste Anstellung|Permanent|Temporary|Contract|Freelance|Freiberuflich|Ausbildung|Apprenticeship|Zeitarbeit|Arbeitnehmerüberlassung|Aushilfe|Volunteer|Ehrenamt';

export const PRESETS: SitePreset[] = [
  // ───────────────────────────── Indeed ─────────────────────────────
  // Built from fixtures/indeed/homepage-feed.html (job feed + embedded job view)
  // plus the classic /jobs search and /viewjob page markup.
  {
    id: 'indeed',
    name: 'Indeed',
    host: '(^|\\.)indeed\\.com$',
    listing: {
      links: [
        'a.jcs-JobTitle[data-jk]',
        'a[data-jk]',
        'h2.jobTitle a[href]',
        'h3.jobTitle a[href]',
      ],
      // Card hrefs are /pagead/clk or /rc/clk redirects – build the stable job URL from data-jk.
      idAttr: { attr: 'data-jk', template: '/viewjob?jk={id}' },
      card: '.cardOutline, .job_seen_beacon, li',
      cardFields: {
        title: ['[id^="jobTitle-"]', '.jobTitle span[title]', '.jobTitle'],
        company: ['[data-testid="company-name"]', '.companyName'],
        location: ['[data-testid="text-location"]', '.companyLocation'],
        salary: ['[data-testid*="salary-snippet"]', '.salary-snippet-container'],
        datePosted: ['[data-testid="myJobsStateDate"]', 'span.date'],
      },
      next: [
        'a[data-testid="pagination-page-next"]',
        'a[aria-label="Next Page"]',
        'a[aria-label="Nächste Seite"]',
      ],
      pageParam: { name: 'start', step: 10, first: 0 },
      ready: ['a[data-jk]', '#mosaic-provider-jobcards', '.jobsearch-NoResult-messageContainer'],
      total: [
        '[data-testid="jobsearch-JobCountAndSortPane-jobCount"]',
        '.jobsearch-JobCountAndSortPane-jobCount',
      ],
    },
    detail: {
      ready: [
        '#jobDescriptionText',
        '[data-testid="jobsearch-JobInfoHeader-title"]',
        '[data-testid="vj-job-title"]',
        '.react-native-html-content',
      ],
      fields: {
        title: [
          {
            selector:
              '[data-testid="jobsearch-JobInfoHeader-title"], h1.jobsearch-JobInfoHeader-title, [data-testid="vj-job-title"]',
            strip: '\\s*-\\s*(job post|Stellenanzeige|job)$',
          },
          'h1',
        ],
        company: [
          '[data-testid="inlineHeader-companyName"] a',
          '[data-testid="inlineHeader-companyName"]',
          '[data-company-name="true"]',
          '[data-testid="company-info-metadata"] a[href*="/cmp/"]',
          '[data-testid="company-info-metadata"] a',
        ],
        location: [
          '[data-testid="inlineHeader-companyLocation"]',
          '[data-testid="job-location"]',
          '[data-testid="jobsearch-JobInfoHeader-companyLocation"]',
          '#jobLocationText',
          '[data-testid="structured-job-summary"] [role="link"][aria-label]',
        ],
        salary: [
          '#salaryInfoAndJobType [class*="salary"]',
          { selector: '#salaryInfoAndJobType span', match: SALARY_RE },
          { selector: '[data-testid="structured-job-summary"] [aria-label]', match: SALARY_RE },
          {
            selector: '#jobDetailsSection [aria-label="Pay"] li, [aria-label="Gehalt"] li',
            all: true,
          },
        ],
        contractType: [
          { selector: '[aria-label="Job type"] li, [aria-label="Anstellungsart"] li', all: true },
          { selector: '#salaryInfoAndJobType span', match: CONTRACT_RE },
          {
            selector: '[data-testid="structured-job-summary"] div',
            match: CONTRACT_RE,
            leaf: true,
          },
        ],
        datePosted: ['[data-testid="myJobsStateDate"]', 'span.date'],
        description: [
          '#jobDescriptionText',
          '.jobsearch-JobComponent-description',
          '.react-native-html-content',
          '.simple-job-description-html',
        ],
      },
    },
    block: {
      loginUrl: ['secure\\.indeed\\.com/(account/)?(login|auth)'],
    },
  },

  // ───────────────────────────── LinkedIn ─────────────────────────────
  // Listing built from fixtures/linkedin/jobs-home.html (job cards link via ?currentJobId=)
  // plus the classic /jobs/search markup. Detail selectors cover the logged-in
  // "unified top card" and the public guest page.
  {
    id: 'linkedin',
    name: 'LinkedIn',
    host: '(^|\\.)linkedin\\.com$',
    listing: {
      links: [
        'a[href*="/jobs/view/"]',
        'a[href*="currentJobId="]',
        '[data-occludable-job-id]',
        '[data-job-id]',
      ],
      idAttr: { attr: 'data-occludable-job-id', template: '/jobs/view/{id}/' },
      jobUrlPattern: '/jobs/view/\\d+|currentJobId=\\d+',
      card: 'li, [data-occludable-job-id], [data-job-id], a[href*="currentJobId="]',
      cardFields: {
        title: [
          '.job-card-list__title--link',
          '.job-card-list__title',
          '.base-search-card__title',
          {
            selector: 'button[aria-label^="Dismiss "]',
            attr: 'aria-label',
            strip: '^Dismiss\\s+|\\s+job$',
          },
        ],
        company: [
          '.artdeco-entity-lockup__subtitle',
          '.job-card-container__primary-description',
          '.base-search-card__subtitle',
        ],
        location: [
          '.job-card-container__metadata-wrapper li',
          '.job-card-container__metadata-item',
          '.job-search-card__location',
        ],
        datePosted: [
          { selector: 'time', attr: 'datetime' },
          { selector: 'span', match: '\\bago\\b|^vor ', leaf: true },
        ],
      },
      next: [
        'button[aria-label="View next page"]',
        'button[aria-label="Nächste Seite anzeigen"]',
        '.jobs-search-pagination__button--next',
      ],
      pageParam: { name: 'start', step: 25, first: 0 },
      ready: [
        'a[href*="/jobs/view/"]',
        'a[href*="currentJobId="]',
        '[data-occludable-job-id]',
        '.jobs-search-no-results-banner',
      ],
      total: ['.jobs-search-results-list__subtitle', '.results-context-header__job-count'],
    },
    detail: {
      ready: [
        '.job-details-jobs-unified-top-card__job-title',
        '.jobs-unified-top-card__job-title',
        '.top-card-layout__title',
        '#job-details',
      ],
      fields: {
        title: [
          '.job-details-jobs-unified-top-card__job-title',
          '.jobs-unified-top-card__job-title',
          '.top-card-layout__title',
          'h1',
        ],
        company: [
          '.job-details-jobs-unified-top-card__company-name',
          '.jobs-unified-top-card__company-name',
          '.topcard__org-name-link',
          '.top-card-layout__second-subline .topcard__flavor',
        ],
        location: [
          '.job-details-jobs-unified-top-card__tertiary-description-container .tvm__text:first-child',
          '.job-details-jobs-unified-top-card__bullet',
          '.jobs-unified-top-card__bullet',
          '.topcard__flavor--bullet',
        ],
        datePosted: [
          '.posted-time-ago__text',
          {
            selector: '.job-details-jobs-unified-top-card__tertiary-description-container span',
            match: '\\bago\\b|^vor |^(Reposted|Erneut)',
            leaf: true,
          },
          { selector: 'time', attr: 'datetime' },
        ],
        salary: [
          '.salary.compensation__salary',
          {
            selector:
              '.job-details-fit-level-preferences button, .job-details-preferences-and-skills__pill',
            match: SALARY_RE,
          },
          {
            selector: '.job-details-jobs-unified-top-card__job-insight span',
            match: SALARY_RE,
            leaf: true,
          },
        ],
        contractType: [
          {
            selector: '.description__job-criteria-item',
            match: '^(Employment type|Beschäftigungsverhältnis)',
            strip: '^(Employment type|Beschäftigungsverhältnis)\\s*',
          },
          {
            selector:
              '.job-details-fit-level-preferences button, .job-details-preferences-and-skills__pill',
            match: CONTRACT_RE,
            all: true,
          },
          {
            selector: '.job-details-jobs-unified-top-card__job-insight span',
            match: CONTRACT_RE,
            leaf: true,
            all: true,
          },
        ],
        description: [
          '#job-details',
          '.jobs-description__content .jobs-box__html-content',
          '.jobs-description-content__text',
          '.show-more-less-html__markup',
          '.description__text',
        ],
      },
    },
    block: {
      loginUrl: ['/authwall', '/login', '/checkpoint/', '/uas/login', '/signup'],
      loginSelectors: ['form.login__form', '.authwall-join-form', '#session_password'],
    },
  },

  // ───────────────────────────── StepStone ─────────────────────────────
  // No saved StepStone page was provided: selectors follow StepStone's data-at attributes
  // and are tested against a hand-made fixture only (fixtures/stepstone/*.synthetic.html).
  {
    id: 'stepstone',
    name: 'StepStone',
    host: '(^|\\.)stepstone\\.(de|at)$',
    listing: {
      links: [
        'a[data-at="job-item-title"]',
        'article[data-at="job-item"] a[href*="stellenangebote--"]',
        'a[href*="/stellenangebote--"]',
      ],
      jobUrlPattern: 'stellenangebote--',
      card: 'article[data-at="job-item"], article',
      cardFields: {
        title: ['[data-at="job-item-title"]'],
        company: ['[data-at="job-item-company-name"]'],
        location: ['[data-at="job-item-location"]'],
        salary: ['[data-at="job-item-salary-info"]'],
        datePosted: [
          { selector: '[data-at="job-item-timeago"] time', attr: 'datetime' },
          '[data-at="job-item-timeago"]',
        ],
      },
      next: [
        'a[data-at="pagination-next"]',
        'a[aria-label="Nächste"]',
        'a[aria-label="Next"]',
        'link[rel="next"]',
      ],
      pageParam: { name: 'page', step: 1, first: 1 },
      ready: [
        'article[data-at="job-item"]',
        'a[href*="stellenangebote--"]',
        '[data-at="no-results"]',
      ],
    },
    detail: {
      ready: ['[data-at="header-job-title"]', '[data-at="job-ad-content"]', 'h1'],
      fields: {
        title: ['[data-at="header-job-title"]', 'h1'],
        company: ['[data-at="metadata-company-name"]', '[data-at="header-company-name"]'],
        location: ['[data-at="metadata-location"]'],
        salary: ['[data-at="metadata-salary"]'],
        contractType: [
          {
            selector: '[data-at="metadata-contract-type"], [data-at="metadata-work-type"]',
            all: true,
          },
        ],
        datePosted: ['[data-at="metadata-online-date"]'],
        description: ['[data-at="job-ad-content"]', '.listing-content', 'article'],
      },
    },
    block: {
      loginUrl: ['/login', '/anmelden'],
    },
  },

  // ───────────────────────────── XING ─────────────────────────────
  // fixtures/xing/jobseeker-criteria.html is a logged-in preferences page (no job list); it is
  // used as a negative test. Job URLs are matched by pattern (/jobs/<slug>-<number>), detail
  // pages are read from JSON-LD first. Search/detail selectors are tested against a hand-made
  // fixture only (fixtures/xing/*.synthetic.html).
  {
    id: 'xing',
    name: 'XING',
    host: '(^|\\.)xing\\.com$',
    listing: {
      links: [
        'a[data-testid="job-search-result"]',
        'article a[href*="/jobs/"]',
        'li a[href*="/jobs/"]',
        'a[href*="/jobs/"]',
      ],
      jobUrlPattern: '/jobs/(?!search|find|my-jobs|top-|recommendations)[a-z0-9-]+-\\d+(?:[/?#]|$)',
      card: 'article, li',
      cardFields: {
        title: ['h2', 'h3'],
        company: ['[data-testid="job-teaser-list-company"]', '[data-testid="job-teaser-company"]'],
        location: [
          '[data-testid="job-teaser-list-location"]',
          '[data-testid="job-teaser-location"]',
        ],
        datePosted: [{ selector: 'time', attr: 'datetime' }, 'time'],
      },
      next: [
        'a[aria-label="Nächste Seite"]',
        'a[aria-label="Next page"]',
        'a[rel="next"]',
        'link[rel="next"]',
        'button[data-testid="load-more-button"]',
      ],
      pageParam: { name: 'page', step: 1, first: 1 },
      ready: ['a[href*="/jobs/"]', 'main'],
    },
    detail: {
      ready: ['h1', 'script[type="application/ld+json"]'],
      fields: {
        title: ['[data-testid="job-details-title"]', 'h1'],
        company: [
          '[data-testid="job-details-company-info-name"]',
          '[data-testid="header-company-name"]',
        ],
        location: ['[data-testid="job-fact-location"]', '[data-testid="job-details-location"]'],
        salary: [
          '[data-testid="job-fact-salary"]',
          { selector: '[data-testid^="job-fact"]', match: SALARY_RE, leaf: true },
        ],
        contractType: [
          '[data-testid="job-fact-employment-type"]',
          { selector: '[data-testid^="job-fact"]', match: CONTRACT_RE, leaf: true },
        ],
        datePosted: [
          { selector: 'time', attr: 'datetime' },
          '[data-testid="job-details-published-date"]',
        ],
        description: [
          '[data-testid="expandable-content"]',
          '[data-testid="job-description"]',
          '[class*="html-description"]',
          'article',
        ],
      },
    },
    block: {
      loginUrl: ['login\\.xing\\.com', '/signup'],
      loginSelectors: ['form[action*="login"]', '[data-testid="login-form"]'],
    },
  },
];

export function presetForUrl(url: string): SitePreset | null {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
  return PRESETS.find((p) => new RegExp(p.host, 'i').test(host)) ?? null;
}
