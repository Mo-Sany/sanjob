import type { JobData, SiteId } from '../shared/types';

/**
 * How to read one value from the page.
 * A plain string is a CSS selector whose text is used.
 */
export type FieldRule =
  | string
  | {
      /** CSS selector. All matches are tried in document order. */
      selector: string;
      /** Read this attribute instead of the text (e.g. "datetime", "content", "aria-label"). */
      attr?: string;
      /** Only accept a match whose value matches this regex (case-insensitive). */
      match?: string;
      /** Remove everything matching this regex (case-insensitive) from the value. */
      strip?: string;
      /** Only consider elements without child elements. */
      leaf?: boolean;
      /** Join the values of ALL matches with ", " instead of using the first one. */
      all?: boolean;
    };

export type FieldName = Exclude<keyof JobData, 'url'>;

/** Rules are tried in order; the first non-empty value wins. */
export type FieldRules = Partial<Record<FieldName, FieldRule[]>>;

export interface IdAttr {
  attr: string;
  template: string;
  /** Regex applied to the attribute value; group 1 is the id. */
  match?: string;
}

export interface ListingPreset {
  /** Selectors for job links. Elements may be <a href> or carry an id attribute (see idAttr). */
  links: string[];
  /** Only accept links whose absolute URL matches this regex. */
  jobUrlPattern?: string;
  /**
   * Build the URL from an attribute when the card has no usable href. "{id}" is replaced by the
   * attribute value, or by the first group of `match` when given.
   */
  idAttr?: IdAttr | IdAttr[];
  /** Closest ancestor of a link that represents one job card (used for card hints). */
  card?: string;
  /** Fields read from the result card; only used when the detail page lacks them. */
  cardFields?: FieldRules;
  /** Selectors for the "next page" control. */
  next: string[];
  /** URL parameter pagination, used when the next control has no href. */
  pageParam?: {
    /** Only use the parameter on pages whose path matches this regex (otherwise: click). */
    path?: string;
    name: string;
    /** Increment per page (e.g. 10 for Indeed "start", 1 for "page"). */
    step: number;
    /** Value of the first page when the parameter is missing. */
    first: number;
    /** Also paginate via the parameter when no next control is visible. */
    always?: boolean;
  };
  /** Wait until one of these selectors exists (SPA pages render late). */
  ready: string[];
  /** Elements showing the total number of results ("360 Jobs"); text search is the fallback. */
  total?: string[];
}

export interface DetailPreset {
  fields: FieldRules;
  ready: string[];
}

export interface BlockPreset {
  /** Regexes tested against the full page URL that indicate a login wall. */
  loginUrl?: string[];
  /** Selectors that indicate a login wall when the page has no job content. */
  loginSelectors?: string[];
}

export interface SitePreset {
  id: Exclude<SiteId, 'generic'>;
  name: string;
  /** Regex tested against the hostname. */
  host: string;
  listing: ListingPreset;
  detail: DetailPreset;
  block?: BlockPreset;
}
