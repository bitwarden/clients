import { ElementPart, nothing } from "lit";
import { AsyncDirective, directive, PartInfo, PartType } from "lit/async-directive.js";

import {
  attachPopoverAnchor,
  attachPopoverTrigger,
  PopoverAnchorHandle,
  PopoverAnchorOptions,
} from "./attach-popover";
import type { BitPopoverBase } from "./popover-base";

type Attach = typeof attachPopoverAnchor;

function popoverDirective(attach: Attach, name: string) {
  return class extends AsyncDirective {
    private handle?: PopoverAnchorHandle;
    private element?: HTMLElement;
    private popover?: BitPopoverBase;
    private options: PopoverAnchorOptions = {};

    constructor(partInfo: PartInfo) {
      super(partInfo);
      if (partInfo.type !== PartType.ELEMENT) {
        throw new Error(`${name}() must be used in an element position`);
      }
    }

    render(_popover: BitPopoverBase | undefined, _options?: PopoverAnchorOptions) {
      return nothing;
    }

    update(part: ElementPart, [popover, options = {}]: Parameters<this["render"]>) {
      this.element = part.element as HTMLElement;
      this.options = options;
      if (popover !== this.popover) {
        this.handle?.destroy();
        this.handle = undefined;
        this.popover = popover;
      }
      if (this.handle) {
        this.handle.update(options);
      } else if (popover) {
        this.handle = attach(this.element, popover, options);
      }
      return nothing;
    }

    protected disconnected() {
      this.handle?.destroy();
      this.handle = undefined;
    }

    protected reconnected() {
      if (this.element && this.popover) {
        this.handle = attach(this.element, this.popover, this.options);
      }
    }
  };
}

/**
 * Toggles a popover when the element is clicked.
 *
 * ```ts
 * html`<bit-icon-button ${popoverTrigger(this.help)} icon="bwi-question-circle" label="Help"></bit-icon-button>`
 * ```
 */
export const popoverTrigger = directive(popoverDirective(attachPopoverTrigger, "popoverTrigger"));

/**
 * Anchors a popover to the element; drive it with `open`.
 *
 * ```ts
 * html`<div ${popoverAnchor(this.step1, { open: this.step === 1, spotlight: true })}>…</div>`
 * ```
 */
export const popoverAnchor = directive(popoverDirective(attachPopoverAnchor, "popoverAnchor"));
