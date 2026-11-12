import { ElementPart, nothing } from "lit";
import { AsyncDirective, directive, PartInfo, PartType } from "lit/async-directive.js";

type Handle<O> = { update?(options: O): void; destroy(): void };

/**
 * Wraps an `attachX(element, options)` function as a Lit element directive.
 *
 * @internal
 */
export function attachDirective<O>(
  attach: (el: HTMLElement, options: O) => Handle<O>,
  name: string,
) {
  class AttachDirective extends AsyncDirective {
    private handle?: Handle<O>;
    private element?: HTMLElement;
    private options!: O;

    constructor(partInfo: PartInfo) {
      super(partInfo);
      if (partInfo.type !== PartType.ELEMENT) {
        throw new Error(`${name}() must be used in an element position`);
      }
    }

    render(_options: O) {
      return nothing;
    }

    update(part: ElementPart, [options]: [O]) {
      this.options = options;
      if (!this.handle) {
        this.element = part.element as HTMLElement;
        this.handle = attach(this.element, options);
      } else {
        this.handle.update?.(options);
      }
      return nothing;
    }

    protected disconnected() {
      this.handle?.destroy();
      this.handle = undefined;
    }

    protected reconnected() {
      if (this.element) {
        this.handle = attach(this.element, this.options);
      }
    }
  }
  return directive(AttachDirective);
}
