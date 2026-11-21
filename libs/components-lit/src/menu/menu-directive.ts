import { ElementPart, nothing } from "lit";
import { AsyncDirective, directive, PartInfo, PartType } from "lit/async-directive.js";

import { attachMenuTrigger, MenuTriggerHandle, MenuTriggerOptions } from "./attach-menu";
import type { BitMenu } from "./menu";

class MenuTriggerDirective extends AsyncDirective {
  private handle?: MenuTriggerHandle;
  private element?: HTMLElement;
  private menu?: BitMenu;
  private options: MenuTriggerOptions = {};

  constructor(partInfo: PartInfo) {
    super(partInfo);
    if (partInfo.type !== PartType.ELEMENT) {
      throw new Error("menuTrigger() must be used in an element position");
    }
  }

  render(_menu: BitMenu | undefined, _options?: MenuTriggerOptions) {
    return nothing;
  }

  update(part: ElementPart, [menu, options = {}]: Parameters<this["render"]>) {
    this.element = part.element as HTMLElement;
    this.options = options;
    if (menu !== this.menu) {
      this.handle?.destroy();
      this.handle = undefined;
      this.menu = menu;
    }
    if (this.handle) {
      this.handle.update(options);
    } else if (menu) {
      this.handle = attachMenuTrigger(this.element, menu, options);
    }
    return nothing;
  }

  protected disconnected() {
    this.handle?.destroy();
    this.handle = undefined;
  }

  protected reconnected() {
    if (this.element && this.menu) {
      this.handle = attachMenuTrigger(this.element, this.menu, this.options);
    }
  }
}

/**
 * Opens a menu when the element is clicked.
 *
 * ```ts
 * html`<bit-button ${menuTrigger(this.menu)}>Options</bit-button>`
 * ```
 */
export const menuTrigger = directive(MenuTriggerDirective);
