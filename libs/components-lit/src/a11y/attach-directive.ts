import { ElementPart, nothing } from "lit";
import { AsyncDirective, directive, PartInfo, PartType } from "lit/async-directive.js";

type Handle<TArgs extends unknown[]> = { update?(...args: TArgs): void; destroy(): void };

/**
 * Builds a Lit element directive from an `attachX(element, ...args)` function, calling the
 * handle's `update` when arguments change and `destroy` when the element leaves the DOM.
 *
 * @internal
 */
export function attachDirective<TArgs extends unknown[]>(
  name: string,
  attach: (el: HTMLElement, ...args: TArgs) => Handle<TArgs>,
) {
  class AttachDirective extends AsyncDirective {
    private handle?: Handle<TArgs>;
    private element?: HTMLElement;
    private args?: TArgs;

    constructor(partInfo: PartInfo) {
      super(partInfo);
      if (partInfo.type !== PartType.ELEMENT) {
        throw new Error(`${name}() must be used in an element position`);
      }
    }

    render(..._args: TArgs) {
      return nothing;
    }

    update(part: ElementPart, args: TArgs) {
      this.element = part.element as HTMLElement;
      this.args = args;
      if (this.handle) {
        this.handle.update?.(...args);
      } else {
        this.handle = attach(this.element, ...args);
      }
      return nothing;
    }

    protected disconnected() {
      this.handle?.destroy();
      this.handle = undefined;
    }

    protected reconnected() {
      if (this.element && this.args) {
        this.handle = attach(this.element, ...this.args);
      }
    }
  }
  return directive(AttachDirective);
}
