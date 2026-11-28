const FOCUSABLE =
  'a[href], area[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), iframe, [tabindex], [contenteditable="true"]';

function isVisible(el: HTMLElement) {
  return el.checkVisibility?.({ checkVisibilityCSS: true }) ?? el.offsetParent !== null;
}

/** Walks the flattened tree (shadow roots and slotted content) in DOM order. */
function* flattenedChildren(node: Node): Generator<Element> {
  const children =
    node instanceof HTMLSlotElement
      ? node.assignedElements({ flatten: true })
      : node instanceof Element && node.shadowRoot
        ? Array.from(node.shadowRoot.children)
        : Array.from((node as ParentNode).children ?? []);

  for (const child of children) {
    yield child;
    yield* flattenedChildren(child);
  }
}

/** Keyboard-focusable elements under `root`, piercing shadow roots, in tab order. */
export function getFocusableElements(root: Node): HTMLElement[] {
  const result: HTMLElement[] = [];
  for (const el of flattenedChildren(root)) {
    if (
      el instanceof HTMLElement &&
      el.matches(FOCUSABLE) &&
      el.tabIndex >= 0 &&
      !el.closest("[inert]") &&
      isVisible(el)
    ) {
      result.push(el);
    }
  }
  return result;
}

/** The deepest focused element, looking through shadow roots. */
export function getDeepActiveElement(): Element | null {
  let active = document.activeElement;
  while (active?.shadowRoot?.activeElement) {
    active = active.shadowRoot.activeElement;
  }
  return active;
}

/**
 * Captures the focused element so it can be restored later, e.g. when an overlay closes.
 * Returns the restore function.
 */
export function captureFocus(): () => void {
  const previous = getDeepActiveElement() as HTMLElement | null;
  return () => {
    if (previous?.isConnected) {
      previous.focus();
    }
  };
}

/** Keeps Tab / Shift+Tab cycling within `container`. Returns a cleanup function. */
export function trapFocus(container: HTMLElement): () => void {
  const onKeydown = (event: KeyboardEvent) => {
    if (event.key !== "Tab") {
      return;
    }
    const focusable = getFocusableElements(container);
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = getDeepActiveElement();
    if (event.shiftKey && (active === first || !container.contains(active as Node))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };
  container.addEventListener("keydown", onKeydown);
  return () => container.removeEventListener("keydown", onKeydown);
}
