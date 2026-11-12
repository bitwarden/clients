import { ReactiveController } from "lit";

import { attachMenuTrigger, MenuTriggerHandle } from "./attach-menu";
import type { BitMenu } from "./menu";

/** Wires `bit-menu`'s `trigger` id attribute to `attachMenuTrigger`. */
export class DeclarativeMenuController implements ReactiveController {
  private handle?: MenuTriggerHandle;
  private attachedTo?: HTMLElement;
  private retryFrame = 0;

  constructor(private readonly host: BitMenu) {
    host.addController(this);
  }

  hostDisconnected() {
    cancelAnimationFrame(this.retryFrame);
    this.detach();
  }

  /** Call after each update. */
  sync() {
    const { host } = this;
    const root = host.getRootNode() as Document | ShadowRoot;
    const target =
      host.trigger && !host.inline ? (root.getElementById?.(host.trigger) ?? undefined) : undefined;
    if (host.trigger && !target && !host.inline) {
      // The trigger may render after the menu.
      cancelAnimationFrame(this.retryFrame);
      this.retryFrame = requestAnimationFrame(() => host.isConnected && this.sync());
    }

    const options = { position: host.position, contextMenu: host.contextMenu };
    if (target === this.attachedTo) {
      this.handle?.update(options);
      return;
    }
    this.detach();
    if (target) {
      this.attachedTo = target;
      this.handle = attachMenuTrigger(target, host, options);
    }
  }

  private detach() {
    this.handle?.destroy();
    this.handle = undefined;
    this.attachedTo = undefined;
  }
}
