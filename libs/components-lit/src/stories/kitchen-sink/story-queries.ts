import { waitFor } from "storybook/test";

/**
 * Query helpers for the kitchen sink's `play` functions. Testing Library doesn't look inside shadow
 * roots, so these walk them.
 */

export const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Every element matching `selector` under `root`, including inside open shadow roots. */
export function deepQueryAll<E extends Element = HTMLElement>(
  root: ParentNode,
  selector: string,
): E[] {
  const results: E[] = [];
  const visit = (node: ParentNode) => {
    node.querySelectorAll("*").forEach((el) => {
      if (el.matches(selector)) {
        results.push(el as E);
      }
      if (el.shadowRoot) {
        visit(el.shadowRoot);
      }
    });
  };
  visit(root);
  return results;
}

/** The name a user would identify the element by: its label, `aria-label` or text. */
export function nameOf(el: Element): string {
  return (el.getAttribute("aria-label") ?? el.getAttribute("label") ?? el.textContent ?? "").trim();
}

/** Waits for an element matching `selector` named `name` under `root`. */
export function findDeep<E extends HTMLElement = HTMLElement>(
  root: ParentNode,
  selector: string,
  name?: string,
): Promise<E> {
  return waitFor(() => {
    const match = deepQueryAll<E>(root, selector).find((el) => name == null || nameOf(el) === name);
    if (!match) {
      throw new Error(`No ${selector} named "${name}"`);
    }
    return match;
  });
}

/** Clicks the element's inner `<a>`/`<button>`, which is what a user's click lands on. */
export function activate(el: HTMLElement) {
  const inner = el.shadowRoot?.querySelector<HTMLElement>("a, button");
  (inner ?? el).click();
}

/** Clicks the element named `name` matching `selector` under `root`. */
export async function clickDeep(root: ParentNode, selector: string, name?: string) {
  activate(await findDeep(root, selector, name));
}

/** The kitchen sink routes with hash routing; give the hash change a moment to render. */
export async function navigateTo(path: "/bitwarden" | "/virtual-scroll") {
  window.location.hash = path;
  await wait(50);
}

/** Opens the side nav if it's collapsed, once the layout has settled. */
export async function openSideNav(canvas: HTMLElement) {
  await wait(200);
  const layout = canvas.querySelector("bit-layout");
  if (!layout?.sideNavState?.open) {
    await clickDeep(canvas, "bit-icon-button", "Toggle side navigation");
  }
}
