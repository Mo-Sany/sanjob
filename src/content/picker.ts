/**
 * Point-and-click list picker with "smart" list detection.
 * Hovering highlights the whole job list (green box) and each item (dashed outline); a label
 * next to the cursor says how many items were found. Click selects, Esc cancels.
 * On Indeed, XING, LinkedIn and StepStone the site preset defines the list; elsewhere the
 * sibling-similarity heuristic is used.
 */
import { listAt, presetList, type JobList } from '../extract/lists';
import { presetForUrl } from '../presets/presets';
import type { Language } from '../shared/types';
import { ListOverlay } from './overlay';

export const PICKER_TEXT: Record<
  Language,
  { found: string; smart: string; hint: string; esc: string }
> = {
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

let active = false;

export function startPicker(lang: Language): void {
  if (active) return;
  active = true;
  const t = PICKER_TEXT[lang];
  const ctx = { doc: document, url: location.href, preset: presetForUrl(location.href) };
  let pageList: JobList | null = presetList(ctx);
  let current: JobList | null = null;

  const overlay = new ListOverlay('sanjob-picker');
  overlay.setBanner(t.esc);
  overlay.show(null, t.hint);

  const describe = (list: JobList | null): void => {
    if (!list) overlay.show(null, t.hint);
    else
      overlay.show(
        list.items,
        t.found.replace('{n}', String(list.items.length)),
        list.smart ? t.smart : null,
      );
  };

  const onMove = (e: MouseEvent): void => {
    overlay.moveTo(e.clientX, e.clientY);
    const target = e.target instanceof Element ? e.target : null;
    if (!target || target === overlay.element) return;
    const found = listAt(target, ctx, pageList);
    if (found?.container !== current?.container || found?.items.length !== current?.items.length) {
      current = found;
      describe(current);
    }
  };

  // Lists that load later (infinite scroll) are picked up.
  const refresh = setInterval(() => {
    pageList = presetList(ctx);
    overlay.schedule();
  }, 1500);

  const finish = (payload: {
    selector: string | null;
    count: number;
    cancelled: boolean;
    preset?: boolean;
  }): void => {
    document.removeEventListener('mousemove', onMove, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKey, true);
    window.removeEventListener('scroll', onScroll, true);
    clearInterval(refresh);
    overlay.destroy();
    active = false;
    void chrome.runtime.sendMessage({ type: 'pickerResult', origin: location.origin, ...payload });
  };

  const onClick = (e: MouseEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    const target = e.target instanceof Element ? e.target : null;
    const found = current ?? (target ? listAt(target, ctx, pageList) : null);
    if (found?.fromPreset) {
      finish({ selector: null, count: found.items.length, cancelled: false, preset: true });
    } else {
      finish({
        selector: found?.selector ?? null,
        count: found?.items.length ?? 0,
        cancelled: false,
      });
    }
  };

  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.preventDefault();
      finish({ selector: null, count: 0, cancelled: true });
    }
  };
  const onScroll = (): void => overlay.schedule();

  document.addEventListener('mousemove', onMove, true);
  document.addEventListener('click', onClick, true);
  document.addEventListener('keydown', onKey, true);
  window.addEventListener('scroll', onScroll, true);
}
