/** One collected job = one row in the table / Excel sheet. */
export interface JobData {
  title: string;
  company: string;
  location: string;
  /** ISO YYYY-MM-DD when parseable, otherwise the raw text from the page. */
  datePosted: string;
  salary: string;
  contractType: string;
  url: string;
  /** Full raw text of the posting, as on the page. */
  description: string;
}

export interface JobRecord extends JobData {
  id?: number;
  /** Normalized URL used for de-duplication. */
  key: string;
  site: SiteId;
  runId: string;
  collectedAt: number;
}

export type SiteId = 'stepstone' | 'indeed' | 'linkedin' | 'xing' | 'generic';

/** Partial job info visible on a result card; used only to fill fields missing on the detail page. */
export type JobHints = Partial<Omit<JobData, 'url' | 'description'>>;

export interface ListingLink {
  url: string;
  hints?: JobHints;
}

export type BlockKind = 'captcha' | 'login' | 'blocked';

export interface BlockInfo {
  kind: BlockKind;
  reason: string;
}

export interface ListingResult {
  links: ListingLink[];
  /** Absolute URL of the next result page, or null when this is the last page. */
  nextUrl: string | null;
  /** True if the "next" control has no href and must be clicked instead. */
  nextIsClick: boolean;
  block: BlockInfo | null;
}

export interface DetailResult {
  job: JobData | null;
  block: BlockInfo | null;
  /** Which fields came from JSON-LD (for diagnostics). */
  source: 'jsonld' | 'selectors' | 'mixed' | 'none';
}

export type QueueStatus = 'pending' | 'done' | 'error' | 'skipped';

export interface QueueItem {
  id?: number;
  runId: string;
  url: string;
  key: string;
  status: QueueStatus;
  hints?: JobHints;
  error?: string;
  order: number;
}

export type RunPhase = 'idle' | 'listing' | 'details' | 'done';
export type RunStatus =
  'idle' | 'running' | 'paused' | 'blocked' | 'interrupted' | 'done' | 'error';

export interface GenericConfig {
  /** CSS selector matching every job card on the results page. */
  cardSelector: string;
  /** Optional selector (inside a card) for the job link. */
  linkSelector?: string;
}

export interface RunState {
  runId: string;
  status: RunStatus;
  phase: RunPhase;
  site: SiteId;
  startUrl: string;
  /** URL of the result page that is processed next (listing phase). */
  pageUrl: string | null;
  pagesDone: number;
  maxPages: number;
  total: number;
  done: number;
  errors: number;
  skipped: number;
  current: string;
  windowId: number | null;
  tabId: number | null;
  block: BlockInfo | null;
  lastError: string;
  /** Consecutive detail pages that returned (almost) empty data. */
  emptyStreak: number;
  suggestWindowMode: boolean;
  generic?: GenericConfig;
  startedAt: number;
  updatedAt: number;
}

export type WindowMode = 'minimized' | 'normal';
export type Language = 'en' | 'de';

export interface Settings {
  language: Language;
  delayMinSec: number;
  delayMaxSec: number;
  maxPages: number;
  windowMode: WindowMode;
  cvText: string;
  /** Claude integration mode. Only 'clipboard' exists today; 'api' is reserved for later. */
  claudeMode: 'clipboard';
}
