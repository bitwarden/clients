import { setAriaAttributes } from "../core/aria";

import type { BitPopoverBase } from "./popover-base";
import { openPopover, PopoverOptions, PopoverRef } from "./popover-ref";

export type PopoverAnchorOptions = PopoverOptions & {
  /** Opens or closes the popover. Applied after the first layout, like `[(popoverOpen)]`. */
  open?: boolean;
  /** Called when the popover opens or closes, including user dismissal. */
  onOpenChange?: (open: boolean) => void;
};

export type PopoverAnchorHandle = {
  readonly isOpen: boolean;
  open(): void;
  close(): void;
  toggle(): void;
  /** Merges new options. Passing `open` opens or closes the popover. */
  update(options: Partial<PopoverAnchorOptions>): void;
  destroy(): void;
};

type TooltipHost = HTMLElement & { setTooltipSuppressed?: (suppressed: boolean) => void };

/**
 * Anchors `popover` to `anchor` with programmatic open/close, replacing `bitPopoverAnchorFor`.
 * Use `attachPopoverTrigger` to open on click instead.
 */
export function attachPopoverAnchor(
  anchor: HTMLElement,
  popover: BitPopoverBase,
  initial: PopoverAnchorOptions = {},
): PopoverAnchorHandle {
  let options = initial;
  let ref: PopoverRef | undefined;
  let destroyed = false;
  let isOpen = false;
  let initialFrame = 0;

  const setOpen = (value: boolean) => {
    if (value !== isOpen) {
      isOpen = value;
      options.onOpenChange?.(value);
    }
  };

  const open = () => {
    if (ref || destroyed) {
      return;
    }
    const current = openPopover(popover, anchor, options);
    ref = current;
    setOpen(true);
    void current.closed.then(() => {
      if (ref === current) {
        ref = undefined;
        setOpen(false);
      }
    });
  };

  const close = () => {
    const current = ref;
    ref = undefined;
    current?.close();
    setOpen(false);
  };

  if (options.open) {
    // Wait for layout to settle before measuring the anchor.
    initialFrame = requestAnimationFrame(() => options.open && open());
  }

  return {
    get isOpen() {
      return isOpen;
    },
    open,
    close,
    toggle: () => (ref ? close() : open()),
    update(next) {
      options = { ...options, ...next };
      if (next.open === true) {
        open();
      } else if (next.open === false) {
        close();
      }
    },
    destroy() {
      cancelAnimationFrame(initialFrame);
      close();
      destroyed = true;
    },
  };
}

/**
 * Toggles `popover` when `trigger` is clicked and keeps `aria-expanded` in sync, replacing
 * `bitPopoverTriggerFor`. Suppresses a `bit-icon-button` trigger's tooltip while open.
 */
export function attachPopoverTrigger(
  trigger: HTMLElement,
  popover: BitPopoverBase,
  initial: PopoverAnchorOptions = {},
): PopoverAnchorHandle {
  let onOpenChange = initial.onOpenChange;
  const sync = (open: boolean) => {
    void setAriaAttributes(trigger, { "aria-expanded": String(open) });
    (trigger as TooltipHost).setTooltipSuppressed?.(open);
  };
  void setAriaAttributes(trigger, { "aria-haspopup": "dialog", "aria-expanded": "false" });

  const onAnchorOpenChange = (open: boolean) => {
    sync(open);
    onOpenChange?.(open);
  };
  const handle = attachPopoverAnchor(trigger, popover, {
    ...initial,
    onOpenChange: onAnchorOpenChange,
  });
  const onClick = () => handle.toggle();
  trigger.addEventListener("click", onClick);

  return {
    get isOpen() {
      return handle.isOpen;
    },
    open: handle.open,
    close: handle.close,
    toggle: handle.toggle,
    update(next) {
      if ("onOpenChange" in next) {
        onOpenChange = next.onOpenChange;
      }
      handle.update({ ...next, onOpenChange: onAnchorOpenChange });
    },
    destroy() {
      handle.destroy();
      trigger.removeEventListener("click", onClick);
      void setAriaAttributes(trigger, { "aria-haspopup": null, "aria-expanded": null });
    },
  };
}
