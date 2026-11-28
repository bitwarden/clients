import { css, ElementPart, nothing } from "lit";
import { AsyncDirective, directive, PartInfo, PartType } from "lit/async-directive.js";

import { resolveAriaTarget } from "../core/aria";

export const HOVER_REVEAL_CONTAINER_ATTR = "bit-hover-reveal-container";
export const HOVER_REVEAL_ATTR = "bit-hover-reveal";
export const HOVER_REVEAL_BOUNDARY_ATTR = "bit-hover-reveal-boundary";
const EXPANDED_ATTR = "bit-hover-reveal-expanded";

/**
 * Pure CSS: an inherited custom property scopes the reveal, so nested containers stay independent.
 * `!important` lets focus outside a boundary, and touch devices (no hover), override the
 * boundary-hover reset. `.tw-test-*` classes force states for visual snapshots.
 */
export const hoverRevealStyles = css`
  [bit-hover-reveal-container] {
    --bit-hover-reveal: 0;
  }
  [bit-hover-reveal-container]:hover,
  [bit-hover-reveal-container].tw-test-hover {
    --bit-hover-reveal: 1;
  }
  [bit-hover-reveal-container]:has(:focus-visible):not(
      :has([bit-hover-reveal-boundary] :focus-visible)
    ),
  [bit-hover-reveal-container]:has(.tw-test-focus-visible),
  [bit-hover-reveal-container][bit-hover-reveal-focus-visible] {
    --bit-hover-reveal: 1 !important;
  }
  @media (hover: none) {
    [bit-hover-reveal-container] {
      --bit-hover-reveal: 1 !important;
    }
  }
  [bit-hover-reveal-container]:has([bit-hover-reveal-boundary]:hover) {
    --bit-hover-reveal: 0;
  }
  [bit-hover-reveal] {
    opacity: var(--bit-hover-reveal, 1);
    transition: opacity 150ms cubic-bezier(0.4, 0, 0.2, 1);
  }
  [bit-hover-reveal][aria-expanded="true"],
  [bit-hover-reveal]:has([aria-expanded="true"]),
  [bit-hover-reveal][bit-hover-reveal-expanded] {
    opacity: 1;
  }
`;

const installed = new WeakSet<Document | ShadowRoot>();

/**
 * Adopts the hover reveal rules into `root` (a document or shadow root). Called automatically for
 * the main document on import and by the attach functions for the element's root.
 */
export function installHoverRevealStyles(root: Document | ShadowRoot = document) {
  if (installed.has(root) || !hoverRevealStyles.styleSheet) {
    return;
  }
  installed.add(root);
  root.adoptedStyleSheets = [...root.adoptedStyleSheets, hoverRevealStyles.styleSheet];
}

const FOCUS_VISIBLE_ATTR = "bit-hover-reveal-focus-visible";
const focusMarked = new Set<Element>();

/**
 * Shadow hosts don't match `:focus-visible` when focus is inside their shadow root, so
 * `:has(:focus-visible)` misses e.g. a focused `bit-icon-button`. Mark containers from the focus
 * event's composed path instead.
 */
function onFocusIn(event: FocusEvent) {
  onFocusOut();
  const path = event.composedPath().filter((node): node is Element => node instanceof Element);
  if (!path[0]?.matches(":focus-visible")) {
    return;
  }
  for (const [index, el] of path.entries()) {
    if (!el.hasAttribute(HOVER_REVEAL_CONTAINER_ATTR)) {
      continue;
    }
    const inBoundary = path
      .slice(0, index)
      .some((node) => node.hasAttribute(HOVER_REVEAL_BOUNDARY_ATTR));
    if (!inBoundary) {
      el.setAttribute(FOCUS_VISIBLE_ATTR, "");
      focusMarked.add(el);
    }
  }
}

function onFocusOut() {
  focusMarked.forEach((el) => el.removeAttribute(FOCUS_VISIBLE_ATTR));
  focusMarked.clear();
}

if (typeof document !== "undefined") {
  installHoverRevealStyles(document);
  document.addEventListener("focusin", onFocusIn, true);
  document.addEventListener("focusout", onFocusOut, true);
}

function installFor(el: Element) {
  const root = el.getRootNode();
  if (root instanceof Document || root instanceof ShadowRoot) {
    installHoverRevealStyles(root);
  }
}

export type HoverRevealHandle = { destroy(): void };

/**
 * Marks a region whose hover or keyboard focus reveals descendant hover-reveal elements. Equivalent
 * to adding the `bit-hover-reveal-container` attribute.
 */
export function attachHoverRevealContainer(el: HTMLElement): HoverRevealHandle {
  installFor(el);
  el.setAttribute(HOVER_REVEAL_CONTAINER_ATTR, "");
  return { destroy: () => el.removeAttribute(HOVER_REVEAL_CONTAINER_ATTR) };
}

/** Excludes a region from the nearest container's hover and focus reveal. */
export function attachHoverRevealBoundary(el: HTMLElement): HoverRevealHandle {
  installFor(el);
  el.setAttribute(HOVER_REVEAL_BOUNDARY_ATTR, "");
  return { destroy: () => el.removeAttribute(HOVER_REVEAL_BOUNDARY_ATTR) };
}

/**
 * Hides `el` until the nearest container is hovered or focused. Uses opacity so `el` stays in the
 * tab order, and keeps it visible while it's expanded (e.g. its menu is open).
 *
 * The attribute alone covers light-DOM `aria-expanded`. This function also mirrors `aria-expanded`
 * from a component's shadow-root `ariaTarget` (e.g. `bit-icon-button`), which CSS can't see.
 */
export function attachHoverReveal(el: HTMLElement): HoverRevealHandle {
  installFor(el);
  el.setAttribute(HOVER_REVEAL_ATTR, "");
  let observer: MutationObserver | undefined;
  let destroyed = false;
  void resolveAriaTarget(el).then((target) => {
    if (destroyed || target === el) {
      return;
    }
    const sync = () =>
      el.toggleAttribute(EXPANDED_ATTR, target.getAttribute("aria-expanded") === "true");
    observer = new MutationObserver(sync);
    observer.observe(target, { attributes: true, attributeFilter: ["aria-expanded"] });
    sync();
  });
  return {
    destroy() {
      destroyed = true;
      observer?.disconnect();
      el.removeAttribute(HOVER_REVEAL_ATTR);
      el.removeAttribute(EXPANDED_ATTR);
    },
  };
}

type Attach = (el: HTMLElement) => HoverRevealHandle;

function attachDirective(attach: Attach, name: string) {
  class AttachDirective extends AsyncDirective {
    private handle?: HoverRevealHandle;
    private element?: HTMLElement;

    constructor(partInfo: PartInfo) {
      super(partInfo);
      if (partInfo.type !== PartType.ELEMENT) {
        throw new Error(`${name}() must be used in an element position`);
      }
    }

    render() {
      return nothing;
    }

    update(part: ElementPart) {
      if (!this.handle) {
        this.element = part.element as HTMLElement;
        this.handle = attach(this.element);
      }
      return nothing;
    }

    protected disconnected() {
      this.handle?.destroy();
      this.handle = undefined;
    }

    protected reconnected() {
      if (this.element) {
        this.handle = attach(this.element);
      }
    }
  }
  return directive(AttachDirective);
}

/** Lit directive for `attachHoverRevealContainer`. */
export const hoverRevealContainer = attachDirective(
  attachHoverRevealContainer,
  "hoverRevealContainer",
);

/** Lit directive for `attachHoverReveal`. */
export const hoverReveal = attachDirective(attachHoverReveal, "hoverReveal");

/** Lit directive for `attachHoverRevealBoundary`. */
export const hoverRevealBoundary = attachDirective(
  attachHoverRevealBoundary,
  "hoverRevealBoundary",
);
