import { resolveAriaTarget } from "../core/aria";

import { BitDisclosure, DISCLOSURE_STATE_EVENT } from "./disclosure";

export type DisclosureTriggerHandle = {
  update(disclosure: BitDisclosure): void;
  destroy(): void;
};

/**
 * Makes `trigger` toggle `disclosure` on click and keeps `aria-expanded` / `aria-controls` on the
 * trigger's ARIA target in sync. Follows the WAI-ARIA disclosure (show/hide) pattern.
 */
export function attachDisclosureTrigger(
  trigger: HTMLElement,
  initial: BitDisclosure,
): DisclosureTriggerHandle {
  let disclosure = initial;

  const sync = async () => {
    const target = await resolveAriaTarget(trigger);
    target.setAttribute("aria-expanded", String(disclosure.open));
    if (target.getRootNode() === disclosure.getRootNode()) {
      target.setAttribute("aria-controls", disclosure.id);
    } else {
      // ids don't resolve across shadow roots; element reflection may reference ancestor trees.
      target.removeAttribute("aria-controls");
      target.ariaControlsElements = [disclosure];
    }
  };

  const onClick = () => disclosure.toggle();

  const listen = () => {
    disclosure.addEventListener(DISCLOSURE_STATE_EVENT, sync);
    const current = disclosure;
    void customElements
      .whenDefined("bit-disclosure")
      .then(() => current.updateComplete)
      .then(sync);
  };
  const unlisten = () => disclosure.removeEventListener(DISCLOSURE_STATE_EVENT, sync);

  trigger.addEventListener("click", onClick);
  listen();

  return {
    update(next) {
      if (next === disclosure) {
        return;
      }
      unlisten();
      disclosure = next;
      listen();
    },
    destroy() {
      unlisten();
      trigger.removeEventListener("click", onClick);
      void resolveAriaTarget(trigger).then((target) => {
        target.removeAttribute("aria-expanded");
        target.removeAttribute("aria-controls");
        target.ariaControlsElements = null;
      });
    },
  };
}
