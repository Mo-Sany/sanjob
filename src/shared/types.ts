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
  /** Description sections (empty when the posting has no recognizable headings). */
  tasks: string;
  profile: string;
  offer: string;
  other: string;
}

export const SECTION_FIELDS = ['tasks', 'profile', 'offer', 'other'] as const;
export type SectionField = (typeof SECTION_FIELDS)[number];
/** The job fields read directly from the page (everything except URL and sections). */
export type JobCore = Omit<JobData, 'url' | SectionField>;

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
export type JobHints = Partial<
  Omit<JobData, 'url' | 'description' | 'tasks' | 'profile' | 'offer' | 'other'>
>;

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
  /** Content-ready check passed (false = timed out waiting for the page). */
  ready?: boolean;
}

export interface DetailResult {
  job: JobData | null;
  block: BlockInfo | null;
  /** Which fields came from JSON-LD (for diagnostics). */
  source: 'jsonld' | 'selectors' | 'mixed' | 'none';
  /** Content-ready check passed (false = timed out waiting for the page). */
  ready?: boolean;
}

/** What Sanjob sees on the current page before a run starts. */
export interface PageAnalysis {
  site: SiteId;
  /** "XING", "Indeed", … or the host name in generic mode. */
  siteName: string;
  isJobList: boolean;
  itemsOnPage: number;
  /** Total number of results announced on the page ("360 Jobs gefunden"), if any. */
  totalResults: number | null;
  /** Number of result pages, if it can be told. */
  totalPages: number | null;
  /** Job URLs on this page (canonical), to check against the history. */
  links: string[];
  /** A preset or a clear repeating list was found ("Smart detection"). */
  confident: boolean;
  /** Jobs on this page the title filter will skip. */
  excludedOnPage: number;
}

/** Friendly status messages shown in the progress card. */
export type NoticeKey = 'retrying' | 'skipped' | 'nothingFound' | 'noResponse';

export type QueueStatus = 'pending' | 'done' | 'error' | 'skipped' | 'filtered';

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
/** pages = go through numbered result pages; continuous = watch one (infinite) page. */
export type CollectMode = 'pages' | 'continuous';
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
  /** Jobs skipped by the title filter (e.g. "Schülerpraktikum"). */
  filtered: number;
  mode: CollectMode;
  /** Continuous mode: the user's tab that is watched for new jobs. */
  watchTabId: number | null;
  /** Continuous mode: all jobs read, waiting for new ones to appear on the page. */
  waiting: boolean;
  current: string;
  /** Title of the job being read (from the result card or the page). */
  currentTitle: string;
  /** Latest friendly notice for the UI. */
  notice: { key: NoticeKey; at: number } | null;
  /** Moving average of the time per job (ms), for the time estimate. */
  avgItemMs: number;
  /** Display name of the site ("XING", "Indeed", host name). */
  siteName: string;
  /** The user's results tab that shows the live view (null = live view stopped). */
  liveTabId: number | null;
  /** The results page the live tab is expected to show. */
  liveUrl: string | null;
  windowId: number | null;
  tabId: number | null;
  block: BlockInfo | null;
  /** Technical details of the last problem – only shown behind a "Details" toggle. */
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
  /** Export: true = all stored jobs, false = only the latest collection. */
  exportAppend: boolean;
  /** Mark the job cards on the results page while collecting. */
  liveView: boolean;
  /** Which title filter is active (a ready-made one, the custom list, or off). */
  filterPreset: 'school' | 'praxissemester' | 'custom' | 'off';
  /**
   * The user's own exclude words (used when filterPreset = 'custom'). Use
   * activeKeywords(settings) to get the words that are actually applied.
   */
  excludeKeywords: string[];
  /** Last chosen collection mode. */
  collectMode: CollectMode;
}

/** State of one job card in the live view. */
export type LiveStatus = 'queued' | 'progress' | 'done' | 'dup' | 'skipped' | 'filtered';

export interface LiveUpdate {
  /** sync = show progress; end = run over (keep ✓ marks); clear = remove everything. */
  action: 'sync' | 'end' | 'clear';
  /** [dedupe key, status] for every job of the run. */
  items: Array<[string, LiveStatus]>;
  /** Key of the job being read right now. */
  focus: string | null;
  done: number;
  total: number;
  /** Estimated seconds left (null = unknown). */
  remainingSec: number | null;
  language: Language;
  generic?: GenericConfig;
}
