import type { GenericConfig, Settings } from './types';

export const DEFAULT_SETTINGS: Settings = {
  language: navigatorLanguage(),
  delayMinSec: 3,
  delayMaxSec: 6,
  maxPages: 10,
  windowMode: 'minimized',
  cvText: '',
  claudeMode: 'clipboard',
  exportAppend: true,
  liveView: true,
};

function navigatorLanguage(): Settings['language'] {
  try {
    return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('de')
      ? 'de'
      : 'en';
  } catch {
    return 'en';
  }
}

const SETTINGS_KEY = 'settings';

/** Clamps user input to sane bounds. */
export function sanitizeSettings(s: Partial<Settings>): Settings {
  const merged = { ...DEFAULT_SETTINGS, ...s };
  const min = Math.max(
    1,
    Math.min(120, Number(merged.delayMinSec) || DEFAULT_SETTINGS.delayMinSec),
  );
  const max = Math.max(
    min,
    Math.min(300, Number(merged.delayMaxSec) || DEFAULT_SETTINGS.delayMaxSec),
  );
  return {
    ...merged,
    language: merged.language === 'de' ? 'de' : 'en',
    delayMinSec: min,
    delayMaxSec: max,
    maxPages: Math.max(1, Math.min(500, Math.round(Number(merged.maxPages) || 1))),
    windowMode: merged.windowMode === 'normal' ? 'normal' : 'minimized',
    cvText: String(merged.cvText ?? ''),
    claudeMode: 'clipboard',
    exportAppend: merged.exportAppend !== false,
    liveView: merged.liveView !== false,
  };
}

export async function loadSettings(): Promise<Settings> {
  const data = await chrome.storage.local.get(SETTINGS_KEY);
  return sanitizeSettings((data[SETTINGS_KEY] as Partial<Settings> | undefined) ?? {});
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = sanitizeSettings({ ...(await loadSettings()), ...patch });
  await chrome.storage.local.set({ [SETTINGS_KEY]: next });
  return next;
}

const genericKey = (origin: string): string => `generic:${origin}`;

export async function loadGenericConfig(origin: string): Promise<GenericConfig | null> {
  const data = await chrome.storage.local.get(genericKey(origin));
  return (data[genericKey(origin)] as GenericConfig | undefined) ?? null;
}

export async function saveGenericConfig(origin: string, cfg: GenericConfig | null): Promise<void> {
  if (cfg) await chrome.storage.local.set({ [genericKey(origin)]: cfg });
  else await chrome.storage.local.remove(genericKey(origin));
}

/** Random delay in ms between min and max seconds (inclusive). */
export function randomDelayMs(
  s: Pick<Settings, 'delayMinSec' | 'delayMaxSec'>,
  rnd = Math.random,
): number {
  return Math.round((s.delayMinSec + rnd() * (s.delayMaxSec - s.delayMinSec)) * 1000);
}
