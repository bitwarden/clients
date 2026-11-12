import { resolveAriaTarget } from "../core/aria";

import { attachDirective } from "./attach-directive";
import { setA11yTitleAndAriaLabel } from "./set-a11y-title-and-aria-label";

export type A11yTitleHandle = { update(title: string): void; destroy(): void };

/**
 * Sets `title` and `aria-label` on `el` to the same text. Existing `title` / `aria-label`
 * attributes win. For components with a shadow-root `ariaTarget`, the label goes on that target.
 */
export function attachA11yTitle(el: HTMLElement, title: string): A11yTitleHandle {
  const originalTitle = el.getAttribute("title");
  const originalAriaLabel = el.getAttribute("aria-label");

  const apply = async (text: string) => {
    el.setAttribute("title", originalTitle ?? text);
    const target = await resolveAriaTarget(el);
    setA11yTitleAndAriaLabel({ element: target, label: originalAriaLabel ?? text });
  };
  void apply(title);

  return {
    update: (next) => void apply(next),
    destroy() {
      if (originalTitle == null) {
        el.removeAttribute("title");
      }
    },
  };
}

/** Lit directive for `attachA11yTitle`: `html\`<button ${a11yTitle("Copy")}>\`` */
export const a11yTitle = attachDirective("a11yTitle", attachA11yTitle);
