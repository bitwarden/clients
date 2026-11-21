import { ElementPart, nothing } from "lit";
import { AsyncDirective, directive, PartInfo, PartType } from "lit/async-directive.js";

import { attachTooltip, TooltipHandle, TooltipOptions } from "./attach-tooltip";

class TooltipDirective extends AsyncDirective {
  private handle?: TooltipHandle;
  private element?: HTMLElement;
  private options?: TooltipOptions;

  constructor(partInfo: PartInfo) {
    super(partInfo);
    if (partInfo.type !== PartType.ELEMENT) {
      throw new Error("tooltip() must be used in an element position");
    }
  }

  render(_content: string, _options?: Omit<TooltipOptions, "content">) {
    return nothing;
  }

  update(part: ElementPart, [content, options]: Parameters<this["render"]>) {
    this.element = part.element as HTMLElement;
    this.options = { ...options, content };
    if (this.handle) {
      this.handle.update(this.options);
    } else {
      this.handle = attachTooltip(this.element, this.options);
    }
    return nothing;
  }

  protected disconnected() {
    this.handle?.destroy();
    this.handle = undefined;
  }

  protected reconnected() {
    if (this.element && this.options) {
      this.handle = attachTooltip(this.element, this.options);
    }
  }
}

/**
 * Adds a tooltip to an element in a Lit template.
 *
 * ```ts
 * html`<bit-icon-button ${tooltip("Copy")} icon="bwi-clone"></bit-icon-button>`
 * ```
 */
export const tooltip = directive(TooltipDirective);
