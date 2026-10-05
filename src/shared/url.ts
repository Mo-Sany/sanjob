/** Query parameters that only track clicks/sessions and never identify a job. */
const TRACKING_PARAMS = [
  /^utm_/i,
  /^(fbclid|gclid|msclkid|mc_cid|mc_eid|_ga|ref|refid|trk|trkinfo|trackingid|tk|from|vjs|xkcb|camk|mtk|sc_cmp|cmp|campaign|campaignid|ebp|origin|position|pagenum|lipi|nwt_nav|src|source|session|sessionid|cid|rank|jsa|advn|adid|sjdu|acatk)$/i,
];

/**
 * Normalized URL used as the de-duplication key:
 * lowercase host without "www.", no hash, no tracking params, sorted query, no trailing slash.
 */
export function normalizeUrl(input: string, base?: string): string {
  let u: URL;
  try {
    u = new URL(input, base);
  } catch {
    return input.trim();
  }
  const site = canonicalJobUrl(u.href);
  if (site !== u.href) u = new URL(site);
  u.hash = '';
  u.hostname = u.hostname.toLowerCase().replace(/^www\./, '');
  u.protocol = 'https:';
  const params = [...u.searchParams.entries()]
    .filter(([k]) => !TRACKING_PARAMS.some((re) => re.test(k)))
    .sort(([a], [b]) => a.localeCompare(b));
  u.search = '';
  for (const [k, v] of params) u.searchParams.append(k, v);
  let path = u.pathname.replace(/\/+$/, '');
  if (!path) path = '/';
  return `${u.protocol}//${u.host}${path}${u.search}`;
}

/**
 * Maps the many URL variants of one job posting to a single canonical, openable URL.
 * - Indeed: /viewjob?jk=<id>, /rc/clk?jk=<id>, /pagead/clk?... (jk inside) -> /viewjob?jk=<id>
 * - LinkedIn: /jobs/view/<slug>-<id>, ...?currentJobId=<id> -> /jobs/view/<id>/
 * - StepStone / XING: strip query (the path identifies the job).
 */
export function canonicalJobUrl(input: string, base?: string): string {
  let u: URL;
  try {
    u = new URL(input, base);
  } catch {
    return input;
  }
  const host = u.hostname.toLowerCase();
  if (/(^|\.)indeed\.[a-z.]+$/.test(host)) {
    const jk = u.searchParams.get('jk') ?? u.searchParams.get('vjk');
    if (jk) return `https://${host}/viewjob?jk=${encodeURIComponent(jk)}`;
    return u.href;
  }
  if (/(^|\.)linkedin\.com$/.test(host)) {
    const viewMatch = u.pathname.match(/\/jobs\/view\/(?:[^/]*?-)?(\d{6,})/);
    const id = viewMatch?.[1] ?? u.searchParams.get('currentJobId');
    if (id && /^\d+$/.test(id)) return `https://www.linkedin.com/jobs/view/${id}/`;
    return u.href;
  }
  if (/(^|\.)(stepstone\.[a-z]+|xing\.com)$/.test(host)) {
    return `https://${host}${u.pathname}`;
  }
  return u.href;
}
