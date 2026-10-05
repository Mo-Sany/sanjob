import { cardFromPicked } from '../extract/generic';
import type { Language } from '../shared/types';

const LABELS: Record<Language, string> = {
  en: 'Sanjob: click one job card in the result list. Press Esc to cancel.',
  de: 'Sanjob: Klicke auf eine Stellenanzeige in der Ergebnisliste. Esc zum Abbrechen.',
};

let active = false;

/** Point-and-click element picker. Sends { type: 'pickerResult' } to the extension. */
export function startPicker(lang: Language): void {
  if (active) return;
  active = true;

  const box = document.createElement('div');
  Object.assign(box.style, {
    position: 'fixed',
    pointerEvents: 'none',
    border: '2px solid #0d9488',
    background: 'rgba(13,148,136,0.12)',
    zIndex: '2147483647',
    borderRadius: '4px',
    transition: 'all 60ms',
  });
  const banner = document.createElement('div');
  banner.textContent = LABELS[lang];
  Object.assign(banner.style, {
    position: 'fixed',
    top: '8px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: '#0f172a',
    color: '#fff',
    font: '14px system-ui, sans-serif',
    padding: '8px 14px',
    borderRadius: '8px',
    zIndex: '2147483647',
    pointerEvents: 'none',
  });
  document.documentElement.append(box, banner);

  const onMove = (e: MouseEvent): void => {
    const target = e.target as Element | null;
    if (!target) return;
    const found = cardFromPicked(target);
    const r = (found?.card ?? target).getBoundingClientRect();
    Object.assign(box.style, {
      left: `${r.left}px`,
      top: `${r.top}px`,
      width: `${r.width}px`,
      height: `${r.height}px`,
    });
  };

  const finish = (payload: {
    selector: string | null;
    count: number;
    cancelled: boolean;
  }): void => {
    document.removeEventListener('mousemove', onMove, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKey, true);
    box.remove();
    banner.remove();
    active = false;
    void chrome.runtime.sendMessage({ type: 'pickerResult', origin: location.origin, ...payload });
  };

  const onClick = (e: MouseEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    const found = e.target ? cardFromPicked(e.target as Element) : null;
    if (found) {
      for (const el of Array.from(document.querySelectorAll<HTMLElement>(found.selector))) {
        el.style.outline = '2px solid #0d9488';
        setTimeout(() => (el.style.outline = ''), 2500);
      }
    }
    finish({ selector: found?.selector ?? null, count: found?.count ?? 0, cancelled: false });
  };

  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') finish({ selector: null, count: 0, cancelled: true });
  };

  document.addEventListener('mousemove', onMove, true);
  document.addEventListener('click', onClick, true);
  document.addEventListener('keydown', onKey, true);
}
