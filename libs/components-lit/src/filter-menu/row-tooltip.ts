import { ElementPart, nothing } from "lit";
import { AsyncDirective, directive, PartInfo, PartType } from "lit/async-directive.js";

import { attachTooltip, TooltipHandle } from "../tooltip/attach-tooltip";

const handles = new WeakMap<Element, TooltipHandle>();

/** The tooltip attached to `el` with {@link rowTooltip}, if any. */
export function rowTooltipHandle(el: Element | null | undefined): TooltipHandle | undefined {
  return el ? handles.get(el) : undefined;
}

class RowTooltipDirective extends AsyncDirective {
  private element?: HTMLElement;
  private content = "";

  constructor(partInfo: PartInfo) {
    super(partInfo);
    if (partInfo.type !== PartType.ELEMENT) {
      throw new Error("rowTooltip() must be used in an element position");
    }
  }

  render(_content: string) {
    return nothing;
  }

  update(part: ElementPart, [content]: Parameters<this["render"]>) {
    this.element = part.element as HTMLElement;
    this.content = content;
    const handle = handles.get(this.element);
    if (handle) {
      handle.update({ content });
    } else {
      handles.set(this.element, attachTooltip(this.element, { content }));
    }
    return nothing;
  }

  protected disconnected() {
    if (this.element) {
      handles.get(this.element)?.destroy();
      handles.delete(this.element);
    }
  }

  protected reconnected() {
    if (this.element) {
      handles.set(this.element, attachTooltip(this.element, { content: this.content }));
    }
  }
}

/**
 * `tooltip()` whose handle a focusable ancestor can reach through {@link rowTooltipHandle}: a tree
 * row takes focus itself, and `focusin` never reaches its label.
 *
 * @internal
 */
export const rowTooltip = directive(RowTooltipDirective);
