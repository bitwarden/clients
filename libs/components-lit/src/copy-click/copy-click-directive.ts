import { ElementPart, nothing } from "lit";
import { AsyncDirective, directive, PartInfo, PartType } from "lit/async-directive.js";

import { attachCopyClick, CopyClickHandle, CopyClickOptions } from "./attach-copy-click";

class CopyClickDirective extends AsyncDirective {
  private handle?: CopyClickHandle;
  private element?: HTMLElement;
  private options?: CopyClickOptions;

  constructor(partInfo: PartInfo) {
    super(partInfo);
    if (partInfo.type !== PartType.ELEMENT) {
      throw new Error("copyClick() must be used in an element position");
    }
  }

  render(_value: string, _options?: Omit<CopyClickOptions, "value">) {
    return nothing;
  }

  update(part: ElementPart, [value, options]: Parameters<this["render"]>) {
    this.element = part.element as HTMLElement;
    this.options = { ...options, value };
    if (this.handle) {
      this.handle.update(this.options);
    } else {
      this.handle = attachCopyClick(this.element, this.options);
    }
    return nothing;
  }

  protected disconnected() {
    this.handle?.destroy();
    this.handle = undefined;
  }

  protected reconnected() {
    if (this.element && this.options) {
      this.handle = attachCopyClick(this.element, this.options);
    }
  }
}

/**
 * Copies a value to the clipboard when the element is clicked.
 *
 * ```ts
 * html`<bit-icon-button ${copyClick(apiKey, { showToast: true })} icon="bwi-clone" label="Copy">
 * </bit-icon-button>`
 * ```
 */
export const copyClick = directive(CopyClickDirective);
