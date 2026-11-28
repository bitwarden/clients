import { ElementPart, nothing } from "lit";
import { AsyncDirective, directive, PartInfo, PartType } from "lit/async-directive.js";

import { attachDisclosureTrigger, DisclosureTriggerHandle } from "./attach-disclosure-trigger";
import type { BitDisclosure } from "./disclosure";

class DisclosureTriggerDirective extends AsyncDirective {
  private handle?: DisclosureTriggerHandle;
  private element?: HTMLElement;
  private disclosure?: BitDisclosure;

  constructor(partInfo: PartInfo) {
    super(partInfo);
    if (partInfo.type !== PartType.ELEMENT) {
      throw new Error("disclosureTriggerFor() must be used in an element position");
    }
  }

  render(_disclosure: BitDisclosure | undefined) {
    return nothing;
  }

  update(part: ElementPart, [disclosure]: Parameters<this["render"]>) {
    this.element = part.element as HTMLElement;
    this.disclosure = disclosure;
    if (!disclosure) {
      this.disconnected();
    } else if (this.handle) {
      this.handle.update(disclosure);
    } else {
      this.handle = attachDisclosureTrigger(this.element, disclosure);
    }
    return nothing;
  }

  protected disconnected() {
    this.handle?.destroy();
    this.handle = undefined;
  }

  protected reconnected() {
    if (this.element && this.disclosure) {
      this.handle = attachDisclosureTrigger(this.element, this.disclosure);
    }
  }
}

/**
 * Makes an element in a Lit template toggle a `bit-disclosure`. Pass the disclosure element, e.g.
 * from a `ref` or `@query`.
 *
 * ```ts
 * html`<bit-icon-button ${disclosureTriggerFor(this.panel)} icon="bwi-sliders" label="Settings">`
 * ```
 */
export const disclosureTriggerFor = directive(DisclosureTriggerDirective);
