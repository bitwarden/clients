import { attachDirective } from "./attach-directive";

export const ARIA_DISABLE_ATTR = "bit-aria-disable";

const installed = new WeakSet<Document>();

function isAriaDisabled(el: EventTarget) {
  return (
    el instanceof Element &&
    el.getAttribute("aria-disabled") === "true" &&
    el.getAttribute(ARIA_DISABLE_ATTR) === "true"
  );
}

/**
 * Installs one capturing click listener on `doc` that swallows clicks on (or inside) elements with
 * both `aria-disabled="true"` and `bit-aria-disable="true"`. Looks through shadow roots via the
 * event's composed path. Called automatically by `attachAriaDisable`.
 */
export function installAriaDisabledClickCapture(doc: Document = document) {
  if (installed.has(doc)) {
    return;
  }
  installed.add(doc);
  doc.addEventListener(
    "click",
    (event) => {
      if (event.composedPath().some(isAriaDisabled)) {
        event.stopPropagation();
        event.preventDefault();
      }
    },
    true,
  );
}

export type AriaDisableHandle = { update(disabled?: boolean): void; destroy(): void };

/**
 * Lets `el` be disabled with `aria-disabled="true"` (so it stays focusable and discoverable) while
 * blocking clicks, like a native disabled button. `bit-button` / `bit-icon-button` do this already.
 *
 * Pass `disabled` to also manage `aria-disabled`; omit it to leave `aria-disabled` to the caller.
 */
export function attachAriaDisable(el: HTMLElement, disabled?: boolean): AriaDisableHandle {
  installAriaDisabledClickCapture(el.ownerDocument);
  el.setAttribute(ARIA_DISABLE_ATTR, "true");
  const setDisabled = (value?: boolean) => {
    if (value !== undefined) {
      el.setAttribute("aria-disabled", String(value));
    }
  };
  setDisabled(disabled);
  return {
    update: setDisabled,
    destroy: () => el.removeAttribute(ARIA_DISABLE_ATTR),
  };
}

/** Lit directive for `attachAriaDisable`: `html\`<a ${ariaDisable(this.disabled)}>\`` */
export const ariaDisable = attachDirective("ariaDisable", attachAriaDisable);
