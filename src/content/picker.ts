/**
 * Point-and-click list picker with "smart" list detection.
 * Hovering highlights the whole repeating list (green box) and each item (dashed outline);
 * a label next to the cursor says how many items were found. Click selects, Esc cancels.
 * All overlays live in a closed shadow root with pointer-events: none, so the page layout
 * and its event handlers are not affected.
 */
import { detectCardGroups, findListAround, type CardGroup } from '../extract/generic';
import { presetForUrl } from '../presets/presets';
import type { Language } from '../shared/types';

const TEXT: Record<Language, { found: string; smart: string; hint: string; esc: string }> = {
  en: {
    found: 'List with {n} items found – click to select',
    smart: 'Smart detection',
    hint: 'Move the mouse over the job list…',
    esc: 'Sanjob: point at the job list and click. Esc to cancel.',
  },
  de: {
    found: 'Liste mit {n} Einträgen gefunden – klicken zum Auswählen',
    smart: 'Intelligente Erkennung',
    hint: 'Bewege die Maus über die Jobliste…',
    esc: 'Sanjob: Zeige auf die Jobliste und klicke. Esc zum Abbrechen.',
  },
};

const MAX_ITEM_BOXES = 300;

const STYLE = `
  :host { all: initial; }
  .root { position: fixed; inset: 0; pointer-events: none; z-index: 2147483647;
    font: 13px/1.35 system-ui, -apple-system, "Segoe UI", sans-serif; }
  .list { position: fixed; border: 2px solid #22c55e; background: rgba(34,197,94,0.10);
    border-radius: 10px; box-shadow: 0 0 0 4px rgba(34,197,94,0.15);
    transition: left .12s ease, top .12s ease, width .12s ease, height .12s ease, opacity .12s ease;
    opacity: 0; }
  .list.on { opacity: 1; }
  .item { position: fixed; border: 1px dashed #16a34a; border-radius: 6px;
    background: rgba(34,197,94,0.04); transition: opacity .12s ease; }
  .label { position: fixed; display: flex; flex-wrap: wrap; align-items: center; gap: 6px;
    max-width: min(480px, calc(100vw - 16px)); padding: 6px 10px; border-radius: 8px;
    background: #14532d; color: #fff; box-shadow: 0 4px 14px rgba(0,0,0,.25);
    transition: left .08s ease, top .08s ease; }
  .label .smart { padding: 1px 6px; border-radius: 999px;
    background: #22c55e; color: #052e16; font-size: 11px; font-weight: 600; }
  .banner { position: fixed; top: 10px; left: 50%; transform: translateX(-50%);
    padding: 8px 14px; border-radius: 10px; background: #0f172a; color: #fff;
    box-shadow: 0 4px 14px rgba(0,0,0,.25); }
`;

let active = false;

export function startPicker(lang: Language): void {
  if (active) return;
  active = true;
  const t = TEXT[lang];
  const preset = presetForUrl(location.href);
  // The page-wide best list, computed once: hovering it shows "Smart detection".
  const topGroup = detectCardGroups(document, 1)[0] ?? null;

  const host = document.createElement('sanjob-picker');
  const shadow = host.attachShadow({ mode: 'closed' });
  shadow.innerHTML = `<style>${STYLE}</style><div class="root"><div class="items"></div><div class="list"></div><div class="label"></div><div class="banner"></div></div>`;
  document.documentElement.append(host);
  const listBox = shadow.querySelector<HTMLDivElement>('.list')!;
  const itemsLayer = shadow.querySelector<HTMLDivElement>('.items')!;
  const label = shadow.querySelector<HTMLDivElement>('.label')!;
  shadow.querySelector<HTMLDivElement>('.banner')!.textContent = t.esc;

  let current: CardGroup | null = null;
  let mouse = { x: 0, y: 0 };
  let frame = 0;

  const isSmart = (g: CardGroup): boolean => {
    if (topGroup && topGroup.parent === g.parent) return true;
    if (!preset) return false;
    return g.cards.some((card) =>
      preset.listing.links.some((sel) => {
        try {
          return card.matches(sel) || card.querySelector(sel) !== null;
        } catch {
          return false;
        }
      }),
    );
  };

  const place = (el: HTMLElement, r: DOMRect, pad = 0): void => {
    el.style.left = `${r.left - pad}px`;
    el.style.top = `${r.top - pad}px`;
    el.style.width = `${r.width + pad * 2}px`;
    el.style.height = `${r.height + pad * 2}px`;
  };

  const render = (): void => {
    frame = 0;
    if (current) {
      listBox.classList.add('on');
      place(listBox, current.parent.getBoundingClientRect(), 4);
      const cards = current.cards.slice(0, MAX_ITEM_BOXES);
      while (itemsLayer.childElementCount < cards.length) {
        const d = document.createElement('div');
        d.className = 'item';
        itemsLayer.append(d);
      }
      while (itemsLayer.childElementCount > cards.length) itemsLayer.lastElementChild?.remove();
      cards.forEach((card, i) =>
        place(itemsLayer.children[i] as HTMLElement, card.getBoundingClientRect()),
      );
      const smart = isSmart(current);
      label.replaceChildren();
      label.append(document.createTextNode(t.found.replace('{n}', String(current.cards.length))));
      if (smart) {
        const badge = document.createElement('span');
        badge.className = 'smart';
        badge.textContent = t.smart;
        label.append(badge);
      }
    } else {
      listBox.classList.remove('on');
      itemsLayer.replaceChildren();
      label.textContent = t.hint;
    }
    // Label follows the cursor but stays inside the viewport.
    const lw = label.offsetWidth || 240;
    const lh = label.offsetHeight || 30;
    const x = Math.min(mouse.x + 16, window.innerWidth - lw - 8);
    const y = mouse.y + 18 + lh > window.innerHeight ? mouse.y - lh - 12 : mouse.y + 18;
    label.style.left = `${Math.max(8, x)}px`;
    label.style.top = `${Math.max(8, y)}px`;
  };
  const schedule = (): void => {
    if (!frame) frame = requestAnimationFrame(render);
  };

  const onMove = (e: MouseEvent): void => {
    mouse = { x: e.clientX, y: e.clientY };
    const target = e.target instanceof Element ? e.target : null;
    const found = target && target !== host ? findListAround(target) : null;
    if (found?.parent !== current?.parent) current = found;
    schedule();
  };

  const finish = (payload: {
    selector: string | null;
    count: number;
    cancelled: boolean;
  }): void => {
    document.removeEventListener('mousemove', onMove, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKey, true);
    window.removeEventListener('scroll', schedule, true);
    window.removeEventListener('resize', schedule);
    if (frame) cancelAnimationFrame(frame);
    host.remove();
    active = false;
    void chrome.runtime.sendMessage({ type: 'pickerResult', origin: location.origin, ...payload });
  };

  const onClick = (e: MouseEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    const target = e.target instanceof Element ? e.target : null;
    const found = current ?? (target ? findListAround(target) : null);
    finish({
      selector: found?.selector ?? null,
      count: found?.cards.length ?? 0,
      cancelled: false,
    });
  };

  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.preventDefault();
      finish({ selector: null, count: 0, cancelled: true });
    }
  };

  document.addEventListener('mousemove', onMove, true);
  document.addEventListener('click', onClick, true);
  document.addEventListener('keydown', onKey, true);
  window.addEventListener('scroll', schedule, true);
  window.addEventListener('resize', schedule);
  schedule();
}
