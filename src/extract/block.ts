import type { BlockPreset } from '../presets/types';
import type { BlockInfo } from '../shared/types';
import { oneLine } from '../shared/text';

const CAPTCHA_SELECTORS = [
  'iframe[src*="recaptcha"]',
  'iframe[src*="hcaptcha"]',
  'iframe[src*="challenges.cloudflare.com"]',
  'iframe[src*="captcha-delivery"]',
  'iframe[src*="arkoselabs"]',
  '#challenge-form',
  '#challenge-running',
  '#challenge-stage',
  '.cf-turnstile',
  '.g-recaptcha',
  '.h-captcha',
  '#px-captcha',
  '#captcha-container',
  'form[action*="captcha"]',
];

const CAPTCHA_TEXT =
  /captcha|are you a (robot|human)|verify (that )?you are (a )?human|bist du ein mensch|sind sie ein (mensch|roboter)|unusual traffic|ungewöhnlichen datenverkehr|security check|sicherheitsüberprüfung|just a moment|einen moment bitte|checking your browser|prüfen ihren browser|additional verification required|zusätzliche überprüfung/i;

const BLOCKED_TEXT =
  /access denied|zugriff verweigert|403 forbidden|request blocked|you have been blocked|wurden blockiert|too many requests|zu viele anfragen|rate limit/i;

const GENERIC_LOGIN_URL = /\/(login|signin|sign-in|anmelden|authwall|auth\/login)(\b|\/|\?|$)/i;

function exists(doc: Document, selectors: string[]): string | null {
  for (const sel of selectors) {
    try {
      if (doc.querySelector(sel)) return sel;
    } catch {
      /* invalid selector in preset */
    }
  }
  return null;
}

/**
 * Detects CAPTCHA, login walls and block pages.
 * `hasContent` = the extractor found job data on this page. Text heuristics only run when
 * nothing was found, so a job ad that merely mentions "login" never triggers a stop.
 * Sanjob never tries to solve or bypass these pages – it stops and asks the user.
 */
export function detectBlock(
  doc: Document,
  url: string,
  preset: BlockPreset | undefined,
  hasContent: boolean,
): BlockInfo | null {
  for (const pattern of preset?.loginUrl ?? []) {
    if (new RegExp(pattern, 'i').test(url)) {
      return { kind: 'login', reason: `Login page (${new URL(url).pathname})` };
    }
  }
  if (hasContent) return null;

  const captchaSel = exists(doc, CAPTCHA_SELECTORS);
  if (captchaSel) return { kind: 'captcha', reason: `CAPTCHA element found (${captchaSel})` };

  const title = oneLine(doc.title);
  const bodyText = oneLine(doc.body?.textContent ?? '').slice(0, 4000);
  // Challenge pages are short; avoid matching inside long normal pages.
  const shortPage = bodyText.length < 3000;
  if (CAPTCHA_TEXT.test(title) || (shortPage && CAPTCHA_TEXT.test(bodyText))) {
    return { kind: 'captcha', reason: title || 'Verification page' };
  }
  if (BLOCKED_TEXT.test(title) || (shortPage && BLOCKED_TEXT.test(bodyText))) {
    return { kind: 'blocked', reason: title || 'Access blocked' };
  }

  const loginSel = exists(doc, preset?.loginSelectors ?? []);
  if (loginSel) return { kind: 'login', reason: `Login required (${loginSel})` };
  if (GENERIC_LOGIN_URL.test(new URL(url, 'https://x.invalid').pathname)) {
    if (doc.querySelector('input[type="password"]')) {
      return { kind: 'login', reason: 'Login required' };
    }
  }
  return null;
}
