import { css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

import { BitElement } from "../core/bit-element";

import { BitwardenIcon } from "./shared-icon";

/** Renders a Bitwarden font icon. Decorative unless `label` is set. */
@customElement("bit-icon")
export class BitIcon extends BitElement {
  static styles = [
    BitElement.styles,
    css`
      :host {
        display: inline-flex;
        line-height: 1;
      }
    `,
  ];

  private readonly internals = this.attachInternals();

  /** Icon class name, e.g. `"bwi-lock"`. */
  @property({ reflect: true }) name?: BitwardenIcon;

  /** Accessible label. When set the icon is exposed as an image; otherwise it's hidden from AT. */
  @property() label?: string;

  /** Use a fixed width so icons in a column align. */
  @property({ type: Boolean, attribute: "fixed-width" }) fixedWidth = false;

  protected willUpdate() {
    this.internals.role = this.label ? "img" : "presentation";
    this.internals.ariaLabel = this.label || null;
    this.internals.ariaHidden = this.label ? null : "true";
  }

  render() {
    return html`<i
      class="bwi ${this.name ?? ""} ${this.fixedWidth ? "bwi-fw" : ""}"
      aria-hidden="true"
    ></i>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-icon": BitIcon;
  }
}
