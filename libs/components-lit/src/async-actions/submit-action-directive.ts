import { ElementPart, nothing } from "lit";
import { AsyncDirective, directive, PartInfo, PartType } from "lit/async-directive.js";

import {
  attachSubmitAction,
  SubmitActionHandle,
  SubmitActionOptions,
} from "./attach-submit-action";

class SubmitActionDirective extends AsyncDirective {
  private handle?: SubmitActionHandle;
  private form?: HTMLFormElement;
  private options?: SubmitActionOptions;

  constructor(partInfo: PartInfo) {
    super(partInfo);
    if (partInfo.type !== PartType.ELEMENT) {
      throw new Error("submitAction() must be used on a <form> element");
    }
  }

  render(
    _handler: SubmitActionOptions["handler"],
    _options?: Omit<SubmitActionOptions, "handler">,
  ) {
    return nothing;
  }

  update(part: ElementPart, [handler, options]: Parameters<this["render"]>) {
    this.form = part.element as HTMLFormElement;
    this.options = { ...options, handler };
    if (this.handle) {
      this.handle.update(this.options);
    } else {
      this.handle = attachSubmitAction(this.form, this.options);
    }
    return nothing;
  }

  protected disconnected() {
    this.handle?.destroy();
    this.handle = undefined;
  }

  protected reconnected() {
    if (this.form && this.options) {
      this.handle = attachSubmitAction(this.form, this.options);
    }
  }
}

/**
 * Angular `[bitSubmit]` for Lit templates. See `attachSubmitAction`.
 *
 * ```ts
 * html`<form ${submitAction(async ({ valid, formData }) => { if (valid) await save(formData); })}>`
 * ```
 */
export const submitAction = directive(SubmitActionDirective);
