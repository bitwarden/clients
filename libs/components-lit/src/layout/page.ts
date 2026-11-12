import { css, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { BitElement } from "../core/bit-element";
import { SideNavStateController } from "../navigation/side-nav-state";

/**
 * A page-level layout region for the main content area of a `bit-layout`. Establishes a
 * full-height flex column whose body fills the available height and owns scrolling.
 *
 * Because the body is a bounded flex region, fill content dropped into it grows to the available
 * height and scrolls internally, rather than growing the page. Regular flowing content simply
 * scrolls in the body.
 *
 * @slot - Page content.
 */
@customElement("bit-page")
export class BitPage extends BitElement {
  static styles = [
    BitElement.styles,
    css`
      :host {
        display: flex;
        height: 100%;
        min-height: 0;
        flex-direction: column;
        overflow-y: hidden;
      }
    `,
  ];

  /**
   * Renders the pre-VFO1 design. Inside a `bit-layout`, the layout's `legacy` also applies.
   *
   * @deprecated Remove when the VFO1 flag is removed.
   */
  @property({ type: Boolean, reflect: true }) legacy = false;

  @state() private hasHeader = false;

  private readonly nav = new SideNavStateController(this);
  private readonly observer = new MutationObserver(() => this.detectHeader());

  connectedCallback() {
    super.connectedCallback();
    this.detectHeader();
    this.observer.observe(this, { childList: true, subtree: true });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.observer.disconnect();
  }

  private detectHeader() {
    const has = !!this.querySelector("bit-header");
    if (has !== this.hasHeader) {
      this.hasHeader = has;
    }
  }

  render() {
    const legacy = this.legacy || this.nav.state.version === "default";
    // The body's padding lives on the scrolling element itself, so content is padded but the
    // scrollbar sits at the true edge. Legacy `bit-header` bleeds out of this padding with
    // negative margins to go full-bleed, so it is also the contract the header relies on.
    return html`<div
      class="tw-flex tw-min-h-0 tw-flex-1 tw-flex-col tw-overflow-y-auto tw-py-6 ${
        legacy ? "tw-px-8" : `tw-px-10 ${this.hasHeader ? "!tw-pt-0" : ""}`
      }"
    >
      <slot></slot>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-page": BitPage;
  }
}
