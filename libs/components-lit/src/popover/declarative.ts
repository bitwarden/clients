import { ReactiveController } from "lit";

import { attachPopoverAnchor, attachPopoverTrigger, PopoverAnchorHandle } from "./attach-popover";
import type { BitPopover } from "./popover";

/** Wires `bit-popover`'s `trigger` / `anchor` id attributes to the attach functions. */
export class DeclarativePopoverController implements ReactiveController {
  private handle?: PopoverAnchorHandle;
  private attachedTo?: HTMLElement;
  private mode?: "trigger" | "anchor";
  private retryFrame = 0;

  constructor(private readonly host: BitPopover) {
    host.addController(this);
  }

  hostDisconnected() {
    cancelAnimationFrame(this.retryFrame);
    this.detach();
  }

  /** Call after each update. */
  sync() {
    const { host } = this;
    const mode = host.trigger ? "trigger" : host.anchor ? "anchor" : undefined;
    const id = host.trigger ?? host.anchor;
    const root = host.getRootNode() as Document | ShadowRoot;
    const target = id ? (root.getElementById?.(id) ?? undefined) : undefined;

    if (id && !target) {
      // The referenced element may render after this one.
      cancelAnimationFrame(this.retryFrame);
      this.retryFrame = requestAnimationFrame(() => host.isConnected && this.sync());
    }

    const options = { open: host.open, position: host.position, spotlight: host.spotlight };
    if (target === this.attachedTo && mode === this.mode) {
      this.handle?.update(options);
      return;
    }
    this.detach();
    if (!target || !mode) {
      return;
    }
    this.attachedTo = target;
    this.mode = mode;
    const attach = mode === "trigger" ? attachPopoverTrigger : attachPopoverAnchor;
    this.handle = attach(target, host, {
      ...options,
      onOpenChange: (open) => {
        if (host.open !== open) {
          host.open = open;
        }
        host.dispatchEvent(
          new CustomEvent("openChange", { detail: { open }, bubbles: true, composed: true }),
        );
      },
    });
  }

  private detach() {
    this.handle?.destroy();
    this.handle = undefined;
    this.attachedTo = undefined;
    this.mode = undefined;
  }
}
