import { css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { unsafeSVG } from "lit/directives/unsafe-svg.js";

import { BitSvg, isBitSvg } from "@bitwarden/assets/svg";

import { BitElement } from "../core/bit-element";

/**
 * Renders an illustration or icon from `@bitwarden/assets/svg`. Decorative unless `label` is set.
 */
@customElement("bit-svg")
export class BitSvgElement extends BitElement {
  static styles = [
    BitElement.styles,
    css`
      :host {
        display: flex;
        justify-content: center;
        max-height: 100%;
      }
    `,
  ];

  private readonly internals = this.attachInternals();

  /** An SVG created with the `svg` tag from `@bitwarden/assets/svg`. */
  @property({ attribute: false }) content?: BitSvg;

  /** Accessible label. When set the SVG is exposed as an image; otherwise it's hidden from AT. */
  @property() label?: string;

  protected willUpdate() {
    this.internals.role = this.label ? "img" : "presentation";
    this.internals.ariaLabel = this.label || null;
    this.internals.ariaHidden = this.label ? null : "true";
  }

  render() {
    // Safe: `BitSvg` can only be created by the `svg` tag, which rejects interpolated values.
    return isBitSvg(this.content) ? unsafeSVG(this.content.svg) : nothing;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-svg": BitSvgElement;
  }
}
