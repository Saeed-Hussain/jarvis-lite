/**
 * Grounding: turning "click Save" into a point on the screen.
 *
 * This is the part that decides whether a computer-use agent is usable or a
 * demo. It is pure — elements in, a scored decision out — so every grounding
 * failure can be reproduced from a captured tree without a screen attached.
 *
 * The approach is evidence-weighted rather than rule-based. A target names
 * several things (a label, a role, an automation id, roughly where it sat when
 * recorded) and each candidate is scored against all of them. Insisting on an
 * exact match of any single field fails constantly in practice: the same
 * button is "Save" in one build, "&Save" in another, "Save (Ctrl+S)" once
 * tooltips are folded into the name, and has no name at all in a web view
 * that never set one.
 *
 * Crucially the result carries a *confidence*, and the margin over the
 * runner-up is part of it. Two equally good "Delete" buttons are not a
 * 90%-confident answer, they are an ambiguous one, and the runner is expected
 * to refuse rather than pick. That refusal is what stops a wrong click.
 */

import type { GroundResult, TargetDescriptor, UiElement } from './types';

/** Below this, the tree has not identified anything and we say so. */
export const CONFIDENCE_FLOOR = 0.5;

/** A winner this close to the runner-up is a tie, not a decision. */
export const AMBIGUITY_MARGIN = 0.08;

/**
 * Normalise an accessible name for comparison.
 * Access-key ampersands, trailing ellipses and parenthesised shortcut hints
 * are decoration, and the same control carries different decoration in
 * different builds of the same app.
 */
export function normalizeName(raw: string): string {
  return String(raw ?? '')
    .replace(/&(?=\w)/g, '')
    .replace(/\((?:&?\w|ctrl|alt|shift)[^)]*\)\s*$/i, '')
    .replace(/[.…]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function tokens(value: string): string[] {
  return normalizeName(value)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** Token overlap, so "save document" still finds "Save the document". */
function overlap(a: string, b: string): number {
  const left = tokens(a);
  const right = tokens(b);
  if (left.length === 0 || right.length === 0) return 0;
  const set = new Set(right);
  const shared = left.filter((t) => set.has(t)).length;
  return shared / Math.max(left.length, right.length);
}

/**
 * Roles that mean the same thing to a user even though the tree distinguishes
 * them — a link that acts like a button, a menu item that acts like a button.
 * Treating a near-miss as a miss is how a workflow breaks on a UI redesign
 * that changed nothing the user can see.
 */
const ROLE_NEIGHBOURS: Record<string, string[]> = {
  button: ['splitbutton', 'hyperlink', 'menuitem', 'listitem', 'tabitem', 'checkbox', 'radiobutton'],
  edit: ['document', 'combobox', 'text'],
  text: ['edit', 'document', 'hyperlink'],
  hyperlink: ['button', 'text'],
  menuitem: ['button', 'listitem'],
  listitem: ['menuitem', 'button', 'treeitem'],
  combobox: ['edit', 'list'],
  checkbox: ['button', 'radiobutton'],
};

function roleScore(wanted: string | undefined, actual: string): number {
  if (!wanted) return 0;
  const a = wanted.toLowerCase();
  const b = actual.toLowerCase();
  if (a === b) return 0.18;
  if ((ROLE_NEIGHBOURS[a] ?? []).includes(b)) return 0.08;
  // A wrong role is real evidence against, but not disqualifying: plenty of
  // apps report a Button as a custom Pane.
  return -0.12;
}

/** Score one candidate against the descriptor. Roughly 0..1, can go negative. */
export function scoreElement(target: TargetDescriptor, el: UiElement, window?: { x: number; y: number; w: number; h: number }): number {
  let score = 0;

  // --- automation id: the strongest signal there is ------------------------
  if (target.id && el.id) {
    if (target.id === el.id) score += 0.55;
    else if (el.id.toLowerCase() === target.id.toLowerCase()) score += 0.5;
  }

  // --- name ----------------------------------------------------------------
  if (target.name) {
    const wanted = normalizeName(target.name);
    const actual = normalizeName(el.name);
    if (wanted && actual) {
      if (wanted === actual) score += 0.5;
      else if (actual.startsWith(wanted) || wanted.startsWith(actual)) score += 0.34;
      else if (actual.includes(wanted)) score += 0.24;
      else score += 0.3 * overlap(wanted, actual);
    }
    // The tooltip often carries the label a visible-text-less icon lacks.
    if (el.help && wanted) {
      const help = normalizeName(el.help);
      if (help === wanted) score += 0.2;
      else if (help.includes(wanted)) score += 0.1;
    }
  }

  // --- role and class ------------------------------------------------------
  score += roleScore(target.role, el.role);
  if (target.cls && el.cls && target.cls.toLowerCase() === el.cls.toLowerCase()) score += 0.08;

  // --- state ---------------------------------------------------------------
  // Clicking a disabled control does nothing and looks like a successful step,
  // which is the worst kind of failure, so it is pushed well down.
  if (!el.enabled) score -= 0.45;

  // --- geometry ------------------------------------------------------------
  const area = el.w * el.h;
  if (window && window.w > 0 && window.h > 0) {
    // A candidate covering most of the window is a container, not the control.
    const coverage = area / (window.w * window.h);
    if (coverage > 0.6) score -= 0.25;
    else if (coverage > 0.3) score -= 0.1;

    // Where it sat when recorded is a tie-break, never a reason on its own —
    // hence the small weight. Windows move and layouts reflow.
    if (target.at) {
      const relX = (el.x + el.w / 2 - window.x) / window.w;
      const relY = (el.y + el.h / 2 - window.y) / window.h;
      const drift = Math.hypot(relX - target.at.x, relY - target.at.y);
      score += Math.max(0, 0.12 * (1 - drift * 2));
    }
  }
  // Sub-pixel slivers are layout artefacts, not controls.
  if (el.w < 3 || el.h < 3) score -= 0.3;

  return score;
}

/**
 * Pick the element a target refers to.
 *
 * Returns `ok: false` with a reason when nothing scores high enough or when
 * the top two are too close to separate. Both of those are answers, not
 * errors — the runner turns them into "I couldn't find it" or "which one?"
 * rather than clicking and hoping.
 */
export function ground(
  target: TargetDescriptor,
  elements: UiElement[],
  options: { window?: { x: number; y: number; w: number; h: number }; ms?: number } = {},
): GroundResult {
  const started = Date.now();
  const base = (): Omit<GroundResult, 'ok' | 'confidence' | 'source' | 'reason'> => ({
    x: 0,
    y: 0,
    candidates: [],
    ms: options.ms ?? Date.now() - started,
  });

  if (!elements.length) {
    return {
      ...base(),
      ok: false,
      confidence: 0,
      source: 'none',
      reason: 'the window reported no addressable controls',
    };
  }

  const scored = elements
    .map((element) => ({ element, score: scoreElement(target, element, options.window) }))
    .sort((a, b) => b.score - a.score);

  const candidates = scored.slice(0, 5);
  const ms = options.ms ?? Date.now() - started;

  // `nth` is how a recording disambiguates the 3rd identical row. It only
  // applies among candidates that are genuinely equivalent to the best one.
  let best = scored[0];
  let runnerUp = scored[1];
  if (typeof target.nth === 'number' && target.nth > 0) {
    const equals = scored.filter((c) => best.score - c.score < AMBIGUITY_MARGIN);
    if (equals.length > target.nth) {
      // Reading order, so "the 2nd Delete" means the 2nd one down the screen.
      const ordered = [...equals].sort((a, b) => a.element.y - b.element.y || a.element.x - b.element.x);
      best = ordered[target.nth];
      runnerUp = undefined as unknown as typeof runnerUp;
    }
  }

  if (!best || best.score < CONFIDENCE_FLOOR) {
    return {
      ...base(),
      candidates,
      ms,
      ok: false,
      confidence: Math.max(0, best?.score ?? 0),
      source: 'a11y',
      reason: best
        ? `the closest match was "${best.element.name || best.element.id}" and it is not close enough`
        : 'nothing matched',
    };
  }

  // A near-tie is ambiguity, and reporting it as high confidence is how an
  // agent clicks the wrong "Delete". The margin is folded into the number the
  // runner sees rather than hidden behind a boolean.
  const margin = runnerUp ? best.score - runnerUp.score : 1;
  const ambiguous = margin < AMBIGUITY_MARGIN;
  const confidence = Math.min(1, ambiguous ? best.score * 0.6 : best.score);

  return {
    ok: !ambiguous,
    x: Math.round(best.element.x + best.element.w / 2),
    y: Math.round(best.element.y + best.element.h / 2),
    element: best.element,
    confidence,
    source: 'a11y',
    candidates,
    ms,
    reason: ambiguous
      ? `"${best.element.name}" and "${runnerUp?.element.name}" are equally good matches — say which one, or record it with an nth`
      : undefined,
  };
}

/**
 * Turn a live element back into a descriptor, for the recorder.
 * The point of recording a descriptor rather than a point is that replay
 * re-grounds; see the note at the top of types.ts.
 */
export function describe(
  el: UiElement,
  window?: { x: number; y: number; w: number; h: number },
  nth?: number,
): TargetDescriptor {
  const descriptor: TargetDescriptor = {
    name: el.name || undefined,
    role: el.role || undefined,
    id: el.id || undefined,
  };
  // Class name is only worth recording when there is nothing better; on its
  // own it matches every button in the app.
  if (!descriptor.name && !descriptor.id && el.cls) descriptor.cls = el.cls;
  if (typeof nth === 'number' && nth > 0) descriptor.nth = nth;
  if (window && window.w > 0 && window.h > 0) {
    descriptor.at = {
      x: (el.x + el.w / 2 - window.x) / window.w,
      y: (el.y + el.h / 2 - window.y) / window.h,
    };
  }
  return descriptor;
}

/** Human-readable target, for labels and the dry run. */
export function targetLabel(target?: TargetDescriptor): string {
  if (!target) return 'the screen';
  const name = target.name || target.id || target.cls || 'an unnamed control';
  const role = target.role ? ` ${target.role.toLowerCase()}` : '';
  const nth = typeof target.nth === 'number' ? ` (#${target.nth + 1})` : '';
  return `the "${name}"${role}${nth}`;
}
