import { css, html, PropertyValues } from "lit";
import { customElement, property } from "lit/decorators.js";

import { AsyncHandler } from "../core/async-action";
import { BitElement } from "../core/bit-element";

import { attachSubmitAction, SubmitActionHandle, SubmitContext } from "./attach-submit-action";

/**
 * Wraps a native `<form>` to give it async submit handling (Angular `[bitSubmit]` +
 * `bitFormButton`) from plain HTML. See `attachSubmitAction` for the behavior.
 *
 * ```html
 * <bit-form><form>...</form></bit-form>
 * <script>document.querySelector("bit-form").action = async ({ valid }) => { ... }</script>
 * ```
 *
 * @slot - A single `<form>`.
 */
@customElement("bit-form")
export class BitForm extends BitElement {
  static styles = [
    BitElement.styles,
    css`
      :host {
        display: contents;
      }
    `,
  ];

  /** Submit handler. The form shows loading until the returned promise settles. */
  @property({ attribute: false }) action?: AsyncHandler<[SubmitContext]>;

  /** Allow submitting while every control in the form is disabled. */
  @property({ type: Boolean, attribute: "allow-disabled-form-submit" })
  allowDisabledFormSubmit = false;

  private handle?: SubmitActionHandle;

  /** The wrapped form. */
  get form(): HTMLFormElement | null {
    return this.querySelector("form");
  }

  get loading() {
    return this.handle?.loading ?? false;
  }

  /** Whether a control changed since load or the last reset. */
  get dirty() {
    return this.handle?.dirty ?? false;
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.handle?.destroy();
    this.handle = undefined;
  }

  protected updated(changed: PropertyValues) {
    super.updated(changed);
    this.attach();
  }

  private attach() {
    const options = { handler: this.action, allowDisabledFormSubmit: this.allowDisabledFormSubmit };
    if (this.handle) {
      this.handle.update(options);
      return;
    }
    const form = this.form;
    if (form) {
      this.handle = attachSubmitAction(form, options);
    }
  }

  connectedCallback() {
    super.connectedCallback();
    if (this.hasUpdated) {
      this.attach();
    }
  }

  render() {
    return html`<slot @slotchange=${() => this.attach()}></slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-form": BitForm;
  }
}
