import { resolveAriaTarget } from "../core/aria";
import { uniqueId } from "../core/ids";
import { getOverlayRoot } from "../core/overlay";
import { autoUpdate, computePosition, Placement } from "../core/position";

import type { BitTooltipPanel } from "./tooltip-panel";
import "./tooltip-panel";

export const TOOLTIP_DELAY_MS = 800;
const OFFSET_PX = 10;

export type TooltipPosition = "above-center" | "below-center" | "left-center" | "right-center";

export type TooltipOptions = {
  content: string;
  /** Preferred position; others are tried if it doesn't fit. Defaults to `"above-center"`. */
  position?: TooltipPosition;
  /** Add the tooltip to the trigger's `aria-describedby`. */
  describedBy?: boolean;
};

export type TooltipHandle = {
  update(options: TooltipOptions): void;
  /** Hides the tooltip and blocks it from opening, e.g. while a menu on the same trigger is open. */
  setSuppressed(suppressed: boolean): void;
  /** Opens after the show delay. For a focusable ancestor whose focus never reaches the trigger. */
  show(): void;
  hide(): void;
  destroy(): void;
};

const placementFor: Record<TooltipPosition, Placement> = {
  "right-center": "end-center",
  "left-center": "start-center",
  "below-center": "bottom-center",
  "above-center": "top-center",
};

// Fallback order matches libs/components: right, left, below, above.
const fallbacks: Placement[] = ["end-center", "start-center", "bottom-center", "top-center"];

/**
 * Shows a tooltip for `trigger` on hover (after a delay) and on keyboard focus. Escape dismisses it.
 * Framework-neutral; used by the `tooltip()` Lit directive and `<bit-tooltip>`.
 */
export function attachTooltip(trigger: HTMLElement, initial: TooltipOptions): TooltipHandle {
  let options = initial;
  let suppressed = false;
  let panel: BitTooltipPanel | undefined;
  let showTimer: ReturnType<typeof setTimeout> | undefined;
  let stopAutoUpdate: (() => void) | undefined;
  let destroyed = false;
  const id = uniqueId("bit-tooltip");
  const existingDescribedBy = trigger.getAttribute("aria-describedby");

  const syncDescribedBy = async () => {
    // Lit directives attach while the trigger is still in a template fragment; wait until it's
    // in its real root so the panel lands in the same tree as the trigger.
    while (!trigger.isConnected) {
      await new Promise(requestAnimationFrame);
      if (destroyed) {
        return;
      }
    }
    if (options.describedBy) {
      ensurePanel().content = options.content;
    }
    const target = await resolveAriaTarget(trigger);
    if (target !== trigger) {
      // The focusable element is in the trigger's shadow root, where ids from the outer tree
      // don't resolve. Element reflection may reference elements in ancestor trees.
      target.ariaDescribedByElements = options.describedBy ? [ensurePanel()] : null;
      return;
    }
    const ids = [existingDescribedBy, options.describedBy ? id : null].filter(Boolean).join(" ");
    if (ids) {
      trigger.setAttribute("aria-describedby", ids);
    } else {
      trigger.removeAttribute("aria-describedby");
    }
  };

  const ensurePanel = () => {
    if (panel) {
      return panel;
    }
    panel = document.createElement("bit-tooltip-panel");
    panel.id = id;
    const root = trigger.getRootNode();
    (root instanceof ShadowRoot ? root : getOverlayRoot()).append(panel);
    return panel;
  };

  const hide = () => {
    clearTimeout(showTimer);
    showTimer = undefined;
    stopAutoUpdate?.();
    stopAutoUpdate = undefined;
    if (panel) {
      panel.visible = false;
      if (panel.matches(":popover-open")) {
        panel.hidePopover();
      }
    }
  };

  const show = () => {
    if (suppressed || !options.content) {
      return;
    }
    clearTimeout(showTimer);
    const el = ensurePanel();
    el.content = options.content;
    showTimer = setTimeout(async () => {
      showTimer = undefined;
      el.showPopover();
      await el.updateComplete;
      const preferred = placementFor[options.position ?? "above-center"];
      stopAutoUpdate = autoUpdate(trigger, el, () =>
        computePosition(trigger, el, { placements: [preferred, ...fallbacks], offset: OFFSET_PX }),
      );
      el.visible = true;
    }, TOOLTIP_DELAY_MS);
  };

  const onFocusIn = (event: FocusEvent) => {
    const target = event.composedPath()[0] as HTMLElement;
    if (target.matches?.(":focus-visible")) {
      show();
    }
  };

  const onKeydown = (event: KeyboardEvent) => {
    if (event.key === "Escape" && (showTimer || panel?.visible)) {
      hide();
    }
  };

  trigger.addEventListener("mouseenter", show);
  trigger.addEventListener("mouseleave", hide);
  trigger.addEventListener("focusin", onFocusIn);
  trigger.addEventListener("focusout", hide);
  document.addEventListener("keydown", onKeydown);
  void syncDescribedBy();

  return {
    update(next) {
      options = next;
      if (panel) {
        panel.content = next.content;
      }
      void syncDescribedBy();
    },
    setSuppressed(value) {
      suppressed = value;
      if (value) {
        hide();
      }
    },
    show,
    hide,
    destroy() {
      destroyed = true;
      hide();
      trigger.removeEventListener("mouseenter", show);
      trigger.removeEventListener("mouseleave", hide);
      trigger.removeEventListener("focusin", onFocusIn);
      trigger.removeEventListener("focusout", hide);
      document.removeEventListener("keydown", onKeydown);
      panel?.remove();
      panel = undefined;
      trigger.setAttribute("aria-describedby", existingDescribedBy ?? "");
      if (!existingDescribedBy) {
        trigger.removeAttribute("aria-describedby");
      }
    },
  };
}
