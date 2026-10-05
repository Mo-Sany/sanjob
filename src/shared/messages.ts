import type {
  DetailResult,
  GenericConfig,
  CollectMode,
  JobHints,
  Language,
  ListingLink,
  ListingResult,
  LiveUpdate,
  PageAnalysis,
  RunState,
  SiteId,
} from './types';

/** Commands executed by the injected content script. */
export type ContentCommand =
  | { type: 'listing'; generic?: GenericConfig; timeoutMs?: number }
  | { type: 'detail'; jobUrl: string; hints?: JobHints; timeoutMs?: number }
  | { type: 'clickNext' }
  | { type: 'analyze'; generic?: GenericConfig; exclude?: string[] }
  | { type: 'watch'; generic?: GenericConfig }
  | { type: 'unwatch' }
  | {
      type: 'hoverPreview';
      on: boolean;
      lang: Language;
      totalResults: number | null;
      generic?: GenericConfig;
    }
  | { type: 'detectCards' }
  | { type: 'startPicker'; lang: Language }
  | { type: 'live'; update: LiveUpdate }
  | { type: 'probe' };

export type ContentResponse =
  | { type: 'listing'; result: ListingResult }
  | { type: 'detail'; result: DetailResult }
  | { type: 'clickNext'; clicked: boolean }
  | { type: 'analyze'; result: PageAnalysis }
  | { type: 'watch'; links: ListingLink[]; url: string }
  | { type: 'detectCards'; selector: string | null; count: number }
  | { type: 'probe'; url: string; title: string; site: SiteId }
  | { type: 'ok' };

/** Side panel → background. */
export type PanelRequest =
  | {
      type: 'start';
      url: string;
      maxPages: number;
      generic?: GenericConfig;
      siteName?: string;
      /** The user's results tab, used for the live view. */
      sourceTabId?: number;
      mode?: CollectMode;
    }
  | { type: 'pause' }
  | { type: 'finish' }
  | { type: 'resume' }
  | { type: 'cancel' }
  | { type: 'getState' }
  | { type: 'setWindowMode'; mode: 'minimized' | 'normal' };

/** Background → side panel (port + broadcast) and content script → side panel. */
export type Broadcast =
  | { type: 'state'; state: RunState | null }
  | { type: 'jobsChanged' }
  | {
      type: 'pickerResult';
      origin: string;
      selector: string | null;
      count: number;
      cancelled: boolean;
      /** The site's own job list was picked (use the preset, no custom selector). */
      preset?: boolean;
    };

/** Problems the UI turns into friendly text (never shown raw). */
export type ProblemCode = 'busy' | 'window' | 'unknown';

export interface PanelResponse {
  ok: boolean;
  code?: ProblemCode;
  /** Technical details – for the console / Details toggle only. */
  details?: string;
  state?: RunState | null;
}

/** Port names. */
export const PANEL_PORT = 'sanjob-panel';
export const KEEPALIVE_PORT = 'sanjob-keepalive';

/** Content script (live view chip) → service worker. */
export interface OpenPanelRequest {
  type: 'openSidePanel';
}

/** Content script (continuous mode) → service worker: new job links appeared on the page. */
export interface WatchLinksMessage {
  type: 'watchLinks';
  url: string;
  links: ListingLink[];
}

/** Content script (hover preview) ↔ side panel: the preview ends when this port closes. */
export const HOVER_PORT = 'sanjob-hover';
