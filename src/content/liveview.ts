/**
 * Live view: marks the job cards on the user's results page while a run is active.
 *
 * - Overlays live in a closed shadow root with pointer-events: none (no layout shift, no
 *   blocked clicks). Only the small progress chip at the bottom-right is clickable.
 * - The state shown always mirrors the real run state sent by the service worker:
 *   queued (links collected) → in progress (being read) → done / already saved / skipped.
 * - Newly queued cards are marked top to bottom (~120 ms each) with smooth scrolling;
 *   afterwards the page follows the job that is currently being read.
 * - Manual scrolling pauses auto-scroll for 5 s. prefers-reduced-motion: no animations,
 *   instant jumps.
 */
import { listingCards } from '../extract/listing';
import { presetForUrl } from '../presets/presets';
import { formatDuration } from '../shared/i18n';
import type { Language, LiveStatus, LiveUpdate } from '../shared/types';

export const SWEEP_STEP_MS = 120;
export const MIN_SCROLL_GAP_MS = 400;
export const USER_SCROLL_PAUSE_MS = 5000;

const TEXT: Record<
  Language,
  {
    progress: string;
    dup: string;
    skipped: string;
    filtered: string;
    left: (t: string) => string;
    finished: (n: string) => string;
    clear: string;
    open: string;
  }
> = {
  en: {
    progress: 'Collecting…',
    dup: 'Already saved',
    skipped: 'Skipped',
    filtered: 'Filtered out',
    left: (t) => `~${t} left`,
    finished: (n) => `${n} collected`,
    clear: 'Clear marks',
    open: 'Open Sanjob',
  },
  de: {
    progress: 'Wird gesammelt…',
    dup: 'Bereits gespeichert',
    skipped: 'Übersprungen',
    filtered: 'Ausgefiltert',
    left: (t) => `noch ~${t}`,
    finished: (n) => `${n} gesammelt`,
    clear: 'Markierungen entfernen',
    open: 'Sanjob öffnen',
  },
};

const STYLE = `
  :host { all: initial; }
  .layer { position: fixed; inset: 0; pointer-events: none; z-index: 2147483646;
    font: 600 11px/1.2 system-ui, -apple-system, "Segoe UI", sans-serif; }
  .box { position: fixed; box-sizing: border-box; border-radius: 8px; pointer-events: none;
    transition: border-color .2s ease, background-color .2s ease; }
  .queued { border: 1.5px dashed rgba(34,197,94,.4); }
  .progress { border: 2px solid #22c55e; animation: sj-pulse 1.2s ease-in-out infinite; }
  .done { border: 2px solid #22c55e; background: rgba(34,197,94,.08); }
  .dup, .filtered { border: 1.5px solid rgba(100,116,139,.55); }
  .skipped { border: 1.5px solid rgba(217,119,6,.7); }
  .badge { position: absolute; top: -10px; right: 10px; display: flex; align-items: center; gap: 5px;
    padding: 2px 8px; border-radius: 999px; color: #fff; background: #16a34a; white-space: nowrap;
    box-shadow: 0 1px 4px rgba(0,0,0,.2); }
  .dup .badge, .filtered .badge { background: #64748b; }
  .skipped .badge { background: #d97706; }
  .pop { animation: sj-pop .2s ease-out; }
  .spin { width: 8px; height: 8px; border: 2px solid rgba(255,255,255,.45); border-top-color: #fff;
    border-radius: 50%; animation: sj-spin .7s linear infinite; }
  .chip { position: fixed; right: 16px; bottom: 16px; display: flex; align-items: center; gap: 10px;
    padding: 8px 14px; border-radius: 999px; background: #14532d; color: #fff; pointer-events: auto;
    font: 600 13px/1.2 system-ui, -apple-system, "Segoe UI", sans-serif; cursor: pointer;
    box-shadow: 0 6px 18px rgba(0,0,0,.25); animation: sj-in .25s ease-out; }
  .chip .num { font-variant-numeric: tabular-nums; }
  .chip .muted { opacity: .8; font-weight: 500; }
  .chip button { all: unset; cursor: pointer; padding: 2px 8px; border-radius: 999px;
    background: rgba(255,255,255,.18); font-weight: 600; }
  .chip button:hover { background: rgba(255,255,255,.3); }
  @keyframes sj-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(34,197,94,.45); }
    50% { box-shadow: 0 0 0 6px rgba(34,197,94,0); } }
  @keyframes sj-pop { from { transform: scale(.6); opacity: .3; } to { transform: scale(1); opacity: 1; } }
  @keyframes sj-spin { to { transform: rotate(360deg); } }
  @keyframes sj-in { from { transform: translateY(8px); opacity: 0; } to { transform: none; opacity: 1; } }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation: none !important; transition: none !important; }
  }
`;

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  } catch {
    return false;
  }
}

interface CardView {
  el: Element;
  box: HTMLDivElement | null;
  status: LiveStatus | null;
}

class LiveView {
  private readonly host: HTMLElement;
  private readonly shadow: ShadowRoot;
  private readonly layer: HTMLDivElement;
  private chip: HTMLDivElement | null = null;
  private cards = new Map<string, CardView>();
  private order: string[] = [];
  private last: LiveUpdate | null = null;
  private sweepQueue: string[] = [];
  private sweepTimer: ReturnType<typeof setTimeout> | undefined;
  private scrollTimer: ReturnType<typeof setTimeout> | undefined;
  private frame = 0;
  private lastScrollAt = 0;
  private programmaticUntil = 0;
  private userPausedUntil = 0;
  private scrolledFocus: string | null = null;
  private shownDone = 0;
  private tick = 0;
  private ended = false;
  private readonly reduced = prefersReducedMotion();
  private readonly cleanup: Array<() => void> = [];

  constructor() {
    this.host = document.createElement('sanjob-live');
    this.host.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483646;';
    this.shadow = this.host.attachShadow({ mode: 'closed' });
    this.shadow.innerHTML = `<style>${STYLE}</style><div class="layer"></div>`;
    this.layer = this.shadow.querySelector('.layer') as HTMLDivElement;
    document.documentElement.append(this.host);

    const schedule = (): void => this.scheduleRender();
    const onUserScroll = (): void => this.userScrolled();
    const onScroll = (): void => {
      if (Date.now() > this.programmaticUntil) this.userScrolled();
      schedule();
    };
    const onKey = (e: KeyboardEvent): void => {
      if (/^(ArrowUp|ArrowDown|PageUp|PageDown|Home|End| )$/.test(e.key)) this.userScrolled();
    };
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') this.syncNow();
    };
    this.listen(window, 'scroll', onScroll, true);
    this.listen(window, 'resize', schedule);
    this.listen(window, 'wheel', onUserScroll, true);
    this.listen(window, 'touchmove', onUserScroll, true);
    this.listen(window, 'keydown', onKey as EventListener, true);
    this.listen(document, 'visibilitychange', onVisible);
    // Late-loading content moves cards around: re-measure regularly.
    const interval = setInterval(schedule, 600);
    this.cleanup.push(() => clearInterval(interval));
  }

  private listen(target: EventTarget, type: string, fn: EventListener, capture = false): void {
    target.addEventListener(type, fn, { capture, passive: true });
    this.cleanup.push(() => target.removeEventListener(type, fn, { capture }));
  }

  /** Applies a new state from the service worker. */
  apply(update: LiveUpdate): void {
    this.last = update;
    if (update.action === 'clear') {
      this.destroy();
      return;
    }
    this.ended = update.action === 'end';
    this.refreshCards(update);
    const target = new Map(update.items);

    for (const key of this.order) {
      const view = this.cards.get(key)!;
      let next = target.get(key) ?? null;
      if (this.ended && next !== 'done') next = null; // run over: keep only ✓ marks
      if (next === view.status) continue;
      if (next === 'queued' && view.status === null && !this.ended) {
        if (!this.sweepQueue.includes(key)) this.sweepQueue.push(key);
        continue;
      }
      this.sweepQueue = this.sweepQueue.filter((k) => k !== key);
      this.setStatus(key, next);
    }
    if (this.reduced) this.flushSweep();
    else this.runSweep();
    this.renderChip();
    if (!this.sweepQueue.length) this.followFocus(false);
    this.scheduleRender();
  }

  /** Back to this tab: jump straight to the current state. */
  private syncNow(): void {
    this.flushSweep();
    this.scrolledFocus = null;
    this.followFocus(true);
    this.scheduleRender();
  }

  private refreshCards(update: LiveUpdate): void {
    const found = listingCards({
      doc: document,
      pageUrl: location.href,
      preset: presetForUrl(location.href),
      generic: update.generic,
    });
    const seen = new Set<string>();
    for (const { key, card } of found) {
      seen.add(key);
      const view = this.cards.get(key);
      if (view) view.el = card;
      else this.cards.set(key, { el: card, box: null, status: null });
    }
    for (const [key, view] of this.cards) {
      if (!seen.has(key) && !view.el.isConnected) {
        view.box?.remove();
        this.cards.delete(key);
      }
    }
    this.order = found.map((f) => f.key);
  }

  private setStatus(key: string, status: LiveStatus | null): void {
    const view = this.cards.get(key);
    if (!view) return;
    const before = view.status;
    view.status = status;
    if (!status) {
      view.box?.remove();
      view.box = null;
      return;
    }
    if (!view.box) {
      view.box = document.createElement('div');
      this.layer.append(view.box);
    }
    view.box.className = `box ${status}`;
    const t = TEXT[this.last?.language ?? 'en'];
    view.box.replaceChildren();
    if (status === 'queued') return;
    const badge = document.createElement('div');
    badge.className = 'badge';
    if (status === 'progress') {
      const spin = document.createElement('span');
      spin.className = 'spin';
      badge.append(spin, document.createTextNode(t.progress));
    } else if (status === 'done') {
      badge.textContent = '✓';
      if (before !== 'done') badge.classList.add('pop');
    } else {
      badge.textContent = status === 'dup' ? t.dup : status === 'filtered' ? t.filtered : t.skipped;
    }
    view.box.append(badge);
  }

  /** Marks newly queued cards one by one, top to bottom, scrolling along. */
  private runSweep(): void {
    if (this.sweepTimer || !this.sweepQueue.length) return;
    const step = (): void => {
      this.sweepTimer = undefined;
      const key = this.sweepQueue.shift();
      if (!key) {
        this.followFocus(false);
        return;
      }
      this.setStatus(key, 'queued');
      const view = this.cards.get(key);
      if (view) this.scrollTo(view.el, false);
      this.scheduleRender();
      this.sweepTimer = setTimeout(step, SWEEP_STEP_MS);
    };
    step();
  }

  private flushSweep(): void {
    clearTimeout(this.sweepTimer);
    this.sweepTimer = undefined;
    for (const key of this.sweepQueue) this.setStatus(key, 'queued');
    this.sweepQueue = [];
  }

  /** Scrolls to the job being read (once per job). */
  private followFocus(instant: boolean): void {
    const focus = this.last?.focus ?? null;
    if (!focus || this.ended || focus === this.scrolledFocus) return;
    const view = this.cards.get(focus);
    if (!view) return;
    if (this.scrollTo(view.el, instant)) this.scrolledFocus = focus;
  }

  private userScrolled(): void {
    this.userPausedUntil = Date.now() + USER_SCROLL_PAUSE_MS;
    clearTimeout(this.scrollTimer);
    // After the pause, continue from the current job.
    this.scrollTimer = setTimeout(() => {
      this.scrolledFocus = null;
      this.followFocus(false);
    }, USER_SCROLL_PAUSE_MS + 50);
  }

  /** Smooth, throttled scrollIntoView; returns false when it had to wait. */
  private scrollTo(el: Element, instant: boolean): boolean {
    const now = Date.now();
    if (document.visibilityState === 'hidden') return false;
    if (now < this.userPausedUntil) return false;
    if (!instant && now - this.lastScrollAt < MIN_SCROLL_GAP_MS) {
      clearTimeout(this.scrollTimer);
      this.scrollTimer = setTimeout(
        () => {
          this.scrolledFocus = null;
          if (this.sweepQueue.length === 0) this.followFocus(false);
        },
        MIN_SCROLL_GAP_MS - (now - this.lastScrollAt) + 10,
      );
      return false;
    }
    this.lastScrollAt = now;
    this.programmaticUntil = now + (instant || this.reduced ? 200 : 1500);
    el.scrollIntoView?.({ behavior: instant || this.reduced ? 'auto' : 'smooth', block: 'center' });
    return true;
  }

  private scheduleRender(): void {
    if (this.frame) return;
    const raf = window.requestAnimationFrame ?? ((cb: FrameRequestCallback) => setTimeout(cb, 16));
    this.frame = raf(() => {
      this.frame = 0;
      this.render();
    }) as unknown as number;
  }

  private render(): void {
    for (const view of this.cards.values()) {
      if (!view.box) continue;
      const r = view.el.getBoundingClientRect();
      const visible = r.width > 0 && r.height > 0 && view.el.isConnected;
      view.box.style.display = visible ? '' : 'none';
      if (!visible) continue;
      view.box.style.left = `${r.left - 3}px`;
      view.box.style.top = `${r.top - 3}px`;
      view.box.style.width = `${r.width + 6}px`;
      view.box.style.height = `${r.height + 6}px`;
    }
  }

  private renderChip(): void {
    const u = this.last;
    if (!u) return;
    const t = TEXT[u.language];
    if (!this.chip) {
      this.chip = document.createElement('div');
      this.chip.className = 'chip';
      this.chip.title = t.open;
      this.chip.addEventListener('click', () => {
        void chrome.runtime.sendMessage({ type: 'openSidePanel' }).catch(() => undefined);
      });
      this.layer.append(this.chip);
    }
    const chip = this.chip;
    chip.replaceChildren();
    const num = document.createElement('span');
    num.className = 'num';
    chip.append(num);
    if (this.ended) {
      num.textContent = `✓ ${t.finished(String(u.done))}`;
      const clear = document.createElement('button');
      clear.textContent = t.clear;
      clear.addEventListener('click', (e) => {
        e.stopPropagation();
        this.destroy();
      });
      chip.append(clear);
      return;
    }
    const left =
      u.remainingSec !== null && u.total > 0
        ? ` · ${t.left(formatDuration(u.remainingSec, u.language))}`
        : '';
    const muted = document.createElement('span');
    muted.className = 'muted';
    muted.textContent = left;
    chip.append(muted);
    this.animateCount(num, u.done, u.total);
  }

  /** Number tick from the shown count to the new one. */
  private animateCount(target: HTMLElement, to: number, total: number): void {
    const from = this.shownDone;
    const id = ++this.tick;
    const write = (n: number): void => {
      target.textContent = `✓ ${n} / ${total}`;
    };
    if (this.reduced || from === to || typeof requestAnimationFrame !== 'function') {
      this.shownDone = to;
      write(to);
      return;
    }
    const start = performance.now();
    const step = (now: number): void => {
      if (id !== this.tick) return;
      const p = Math.min(1, (now - start) / 400);
      const n = Math.round(from + (to - from) * p);
      write(n);
      this.shownDone = n;
      if (p < 1) requestAnimationFrame(step);
    };
    write(from);
    requestAnimationFrame(step);
  }

  destroy(): void {
    clearTimeout(this.sweepTimer);
    clearTimeout(this.scrollTimer);
    this.cleanup.forEach((fn) => fn());
    this.host.remove();
    if (current === this) current = null;
  }

  /** For tests: what each card currently shows. */
  snapshot(): { statuses: Record<string, LiveStatus | null>; chip: string; badges: string[] } {
    const statuses: Record<string, LiveStatus | null> = {};
    for (const key of this.order) statuses[key] = this.cards.get(key)?.status ?? null;
    return {
      statuses,
      chip: this.chip?.textContent ?? '',
      badges: Array.from(this.layer.querySelectorAll('.badge')).map((b) => b.textContent ?? ''),
    };
  }
}

let current: LiveView | null = null;

/** Entry point for the 'live' content command. */
export function applyLiveUpdate(update: LiveUpdate): void {
  if (update.action === 'clear') {
    current?.destroy();
    return;
  }
  if (!current) current = new LiveView();
  current.apply(update);
}

/** For tests. */
export function liveViewForTests(): LiveView | null {
  return current;
}
