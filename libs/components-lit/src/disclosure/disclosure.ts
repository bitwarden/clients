import { css, html, PropertyValues } from "lit";
import { customElement, property } from "lit/decorators.js";

import { BitElement } from "../core/bit-element";
import { uniqueId } from "../core/ids";

/** Non-bubbling event fired on every `open` change, so triggers can sync their ARIA state. */
export const DISCLOSURE_STATE_EVENT = "bit-disclosure-state";

/**
 * A content area whose visibility is controlled by a trigger, typically a `bit-icon-button`. Connect
 * the trigger with `attachDisclosureTrigger()`, the `disclosureTriggerFor()` Lit directive, or by
 * wrapping it in `<bit-disclosure-trigger for="...">`.
 *
 * ```html
 * <bit-disclosure-trigger for="settings">
 *   <bit-icon-button icon="bwi-sliders" label="Settings"></bit-icon-button>
 * </bit-disclosure-trigger>
 * <bit-disclosure id="settings">click button to hide this content</bit-disclosure>
 * ```
 *
 * @slot - Content shown while open
 * @fires openChange - `detail` is the new `open` value, after the trigger toggles it
 */
@customElement("bit-disclosure")
export class BitDisclosure extends BitElement {
  static styles = [
    BitElement.styles,
    css`
      :host(:not([open])) {
        display: none !important;
      }
    `,
  ];

  /** Controls the visibility of the disclosure content. */
  @property({ type: Boolean, reflect: true }) open = false;

  connectedCallback() {
    super.connectedCallback();
    if (!this.id) {
      this.id = uniqueId("bit-disclosure");
    }
  }

  /** Flips `open` and fires `openChange`, as a user toggle would. */
  toggle() {
    this.open = !this.open;
    this.dispatchEvent(
      new CustomEvent<boolean>("openChange", { detail: this.open, bubbles: true, composed: true }),
    );
  }

  protected updated(changed: PropertyValues<this>) {
    if (changed.has("open")) {
      this.dispatchEvent(new Event(DISCLOSURE_STATE_EVENT));
    }
  }

  render() {
    return html`<slot></slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-disclosure": BitDisclosure;
  }
}
