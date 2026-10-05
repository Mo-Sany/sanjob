import type { FieldName, FieldRule, FieldRules } from '../presets/types';
import { elementText, oneLine } from '../shared/text';

/** Fields that keep line breaks; all others are single-line. */
const MULTILINE: ReadonlySet<FieldName> = new Set(['description']);

function safeQueryAll(root: ParentNode, selector: string): Element[] {
  try {
    return Array.from(root.querySelectorAll(selector));
  } catch {
    return [];
  }
}

function valueOf(el: Element, attr: string | undefined, multiline: boolean): string {
  if (attr) return oneLine(el.getAttribute(attr));
  return multiline ? elementText(el) : oneLine(elementText(el));
}

/** Applies one rule; returns '' when nothing matches. */
export function applyRule(root: ParentNode, rule: FieldRule, multiline = false): string {
  const r = typeof rule === 'string' ? { selector: rule } : rule;
  const match = r.match ? new RegExp(r.match, 'i') : null;
  const strip = r.strip ? new RegExp(r.strip, 'gi') : null;
  const values: string[] = [];
  for (const el of safeQueryAll(root, r.selector)) {
    if (r.leaf && el.childElementCount > 0) continue;
    let v = valueOf(el, r.attr, multiline);
    if (!v) continue;
    if (match && !match.test(v)) continue;
    if (strip) v = multiline ? v.replace(strip, '').trim() : oneLine(v.replace(strip, ''));
    if (!v) continue;
    if (!r.all) return v;
    if (!values.includes(v)) values.push(v);
  }
  return values.join(', ');
}

export function applyRules(
  root: ParentNode,
  rules: FieldRule[] | undefined,
  multiline = false,
): string {
  for (const rule of rules ?? []) {
    const v = applyRule(root, rule, multiline);
    if (v) return v;
  }
  return '';
}

/** Reads every field in `rules` from `root`. */
export function readFields(
  root: ParentNode,
  rules: FieldRules,
): Partial<Record<FieldName, string>> {
  const out: Partial<Record<FieldName, string>> = {};
  for (const [name, list] of Object.entries(rules) as Array<[FieldName, FieldRule[]]>) {
    const v = applyRules(root, list, MULTILINE.has(name));
    if (v) out[name] = v;
  }
  return out;
}
