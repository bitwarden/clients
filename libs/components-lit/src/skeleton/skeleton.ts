import { css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

import { BitElement } from "../core/bit-element";

export type SkeletonEdgeShape = "box" | "circle";

/**
 * Basic skeleton loading component that can be used to represent content that is loading.
 * Use for layout-level elements and text, not for interactive elements.
 *
 * Customize the shape's edges with `edge-shape`. Size it by applying classes or styles to the
 * `bit-skeleton` element (i.e. `tw-w-40 tw-h-8`).
 *
 * If you're looking to represent lines of text, use the `bit-skeleton-text` helper component.
 */
@customElement("bit-skeleton")
export class BitSkeleton extends BitElement {
  static styles = [
    BitElement.styles,
    css`
      :host {
        display: block;
      }
    `,
  ];

  /** The shape of the corners of the skeleton element. */
  @property({ attribute: "edge-shape", reflect: true }) edgeShape: SkeletonEdgeShape = "box";

  connectedCallback() {
    super.connectedCallback();
    this.setAttribute("aria-hidden", "true");
  }

  render() {
    return html`<div
      class="tw-size-full tw-bg-secondary-100 tw-animate-pulse ${
        this.edgeShape === "circle" ? "tw-rounded-full" : "tw-rounded"
      }"
    ></div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-skeleton": BitSkeleton;
  }
}
