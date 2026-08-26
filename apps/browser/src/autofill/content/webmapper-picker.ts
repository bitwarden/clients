// webmapper selector-capture helpers, called from the context-menu-handler
// content script. Pure DOM — no Angular, no BrowserApi (per the content-script
// rules). Ported from webmapper's picker.js.
//
// Iframe / cross-frame selector composition is intentionally not present — see
// webmapper's notes. Captures inside iframes produce frame-local selectors
// only; the user hand-edits `iframe… >>>` prefixes when needed.

import type { ContainerCandidate } from "../webmapper/draft";
import { WebmapperContainerCandidatesResponse } from "../webmapper/messaging";
import { generateSelector, GeneratedSelector } from "../webmapper/selector";

// The container-candidate walk caps how far up the DOM it looks beyond the
// right-clicked element, the nearest <form>, and the smallest ancestor of
// already-captured fields. Past that, ancestors are noisy and rarely useful.
const MAX_EXTRA_ANCESTORS = 4;

/** Generate a selector for the captured element; a null target yields a null selector. */
export function buildSelectorCapture(target: Element | null): GeneratedSelector {
  return generateSelector(target);
}

/** Propose container elements for the captured target and any captured fields. */
export function buildContainerCandidates(
  target: Element | null,
  fieldSelectors: string[],
): WebmapperContainerCandidatesResponse {
  if (!target) {
    return { candidates: [] };
  }
  return { candidates: collectContainerCandidates(target, fieldSelectors) };
}

function collectContainerCandidates(
  target: Element,
  fieldSelectors: string[],
): ContainerCandidate[] {
  const fieldElements = resolveFieldElements(fieldSelectors);
  const visited = new Set<Element>();
  const out: ContainerCandidate[] = [];

  const consider = (el: Element | null, label: string) => {
    if (!el || el.nodeType !== 1 || visited.has(el)) {
      return;
    }
    visited.add(el);
    const gen = generateSelector(el);
    if (!gen.selector) {
      return;
    }
    out.push({
      selector: gen.selector,
      label,
      tag: el.tagName.toLowerCase(),
      structural: gen.structural,
      warnings: gen.warnings,
    });
  };

  consider(target, "right-clicked element");
  consider(target.closest("form"), "nearest <form>");

  if (fieldElements.length > 0) {
    consider(
      smallestCommonAncestor(fieldElements),
      `smallest ancestor of ${fieldElements.length} captured field${
        fieldElements.length === 1 ? "" : "s"
      }`,
    );
  }

  consider(target.parentElement, "parent element");

  let cur = target.parentElement?.parentElement ?? null;
  let extra = 0;
  while (cur && !isRoot(cur) && extra < MAX_EXTRA_ANCESTORS) {
    if (!visited.has(cur)) {
      consider(cur, `<${cur.tagName.toLowerCase()}> ancestor`);
      extra++;
    }
    cur = cur.parentElement;
  }

  return out;
}

function isRoot(el: Element): boolean {
  return el.tagName === "BODY" || el.tagName === "HTML";
}

function resolveFieldElements(selectors: string[]): Element[] {
  const out: Element[] = [];
  for (const sel of selectors) {
    if (typeof sel !== "string") {
      continue;
    }
    try {
      const el = document.querySelector(sel);
      if (el) {
        out.push(el);
      }
    } catch {
      // selectors containing `>>>` won't parse via querySelector; ignore.
    }
  }
  return out;
}

function smallestCommonAncestor(elements: Element[]): Element | null {
  if (elements.length === 0) {
    return null;
  }
  let candidate: Element | null = elements[0];
  while (candidate) {
    const ancestor = candidate;
    if (elements.every((el) => ancestor === el || ancestor.contains(el))) {
      return ancestor;
    }
    candidate = candidate.parentElement;
  }
  return null;
}
