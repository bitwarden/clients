import { queryForAutofocusDescendants } from "./autofocus";

/** Per-navigation focus option, typically stored in history state so back/forward keep it. */
export type FocusAfterNav = boolean | string | undefined;

export type RouterFocusManager = {
  /**
   * Call after each completed SPA navigation (e.g. Angular's `NavigationEnd`, the Navigation API's
   * `navigatesuccess`, or your router's equivalent).
   *
   * @param focusAfterNav `false` opts out, a selector string changes the target, anything else
   *   focuses `main`.
   * @param ready Resolves once the new view has rendered; focus waits for it.
   */
  onNavigationEnd(focusAfterNav?: FocusAfterNav, ready?: Promise<unknown>): Promise<void>;
};

/** `document.querySelector`, falling back to a search through open shadow roots. */
function deepQuerySelector<T extends Element>(root: ParentNode, selector: string): T | null {
  const match = root.querySelector<T>(selector);
  if (match) {
    return match;
  }
  for (const el of Array.from(root.querySelectorAll("*"))) {
    const found = el.shadowRoot && deepQuerySelector<T>(el.shadowRoot, selector);
    if (found) {
      return found;
    }
  }
  return null;
}

/**
 * Moves focus after SPA navigations so screen reader users learn the page changed. Framework
 * neutral: the app wires it to its router. The first navigation (page load) is skipped so users
 * aren't moved past the navigation content. If `main` contains a `bit-autofocus` element, that
 * takes precedence.
 */
export function createRouterFocusManager(root: Document = document): RouterFocusManager {
  let first = true;

  const focusTarget = (selector: string) => {
    const target = deepQuerySelector<HTMLElement>(root, selector);
    const main = deepQuerySelector<HTMLElement>(root, "main");
    if (main && queryForAutofocusDescendants(main).length > 0) {
      return;
    }
    if (target) {
      target.focus();
    } else {
      // eslint-disable-next-line no-console
      console.warn(`RouterFocusManager: Could not find element with selector "${selector}"`);
    }
  };

  return {
    async onNavigationEnd(focusAfterNav, ready) {
      if (first) {
        first = false;
        return;
      }
      if (focusAfterNav === false) {
        return;
      }
      await ready;
      focusTarget(
        typeof focusAfterNav === "string" && focusAfterNav.length > 0 ? focusAfterNav : "main",
      );
    },
  };
}
