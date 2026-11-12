import { css, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { BitElement } from "../core/bit-element";

function hasComposedAncestor(el: Element, names: string[]) {
  let node: Element | null = el;
  while (node) {
    node = node.parentElement ?? ((node.getRootNode() as ShadowRoot).host || null);
    if (node && names.includes(node.localName)) {
      return true;
    }
  }
  return false;
}

/**
 * Simple container that applies a responsive bottom margin and renders a semantic `section`.
 *
 * @slot - Section content, typically a `bit-section-header` followed by the body
 */
@customElement("bit-section")
export class BitSection extends BitElement {
  static styles = [
    BitElement.styles,
    css`
      :host {
        display: block;
      }
    `,
  ];

  /** Remove the bottom margin, e.g. for the last section on a page. */
  @property({ type: Boolean, attribute: "disable-margin" }) disableMargin = false;

  // The larger desktop margin doesn't apply inside dialogs and browser popup pages.
  @state() private inCompactContainer = false;

  connectedCallback() {
    super.connectedCallback();
    this.inCompactContainer = hasComposedAncestor(this, ["bit-dialog", "popup-page"]);
  }

  render() {
    const classes = this.disableMargin
      ? ""
      : this.inCompactContainer
        ? "tw-mb-5 bit-compact:tw-mb-4"
        : "tw-mb-5 bit-compact:tw-mb-4 md:tw-mb-12";
    return html`<section class=${classes}><slot></slot></section>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-section": BitSection;
  }
}
