import type {
  DetailResult,
  GenericConfig,
  JobHints,
  Language,
  ListingResult,
  RunState,
  SiteId,
} from './types';

/** Commands executed by the injected content script. */
export type ContentCommand =
  | { type: 'listing'; generic?: GenericConfig }
  | { type: 'detail'; jobUrl: string; hints?: JobHints }
  | { type: 'clickNext' }
  | { type: 'detectCards' }
  | { type: 'startPicker'; lang: Language }
  | { type: 'probe' };

export type ContentResponse =
  | { type: 'listing'; result: ListingResult }
  | { type: 'detail'; result: DetailResult }
  | { type: 'clickNext'; clicked: boolean }
  | { type: 'detectCards'; selector: string | null; count: number }
  | { type: 'probe'; url: string; title: string; site: SiteId }
  | { type: 'ok' };

/** Side panel → background. */
export type PanelRequest =
  | { type: 'start'; url: string; maxPages: number; generic?: GenericConfig }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'cancel' }
  | { type: 'getState' }
  | { type: 'setWindowMode'; mode: 'minimized' | 'normal' };

/** Background → side panel (broadcast) and content script → side panel. */
export type Broadcast =
  | { type: 'state'; state: RunState | null }
  | { type: 'jobsChanged' }
  | {
      type: 'pickerResult';
      origin: string;
      selector: string | null;
      count: number;
      cancelled: boolean;
    };

export interface PanelResponse {
  ok: boolean;
  error?: string;
  state?: RunState | null;
}
