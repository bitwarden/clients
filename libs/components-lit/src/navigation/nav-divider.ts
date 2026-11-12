import { css, html, nothing } from "lit";
import { customElement } from "lit/decorators.js";

import { BitElement } from "../core/bit-element";

import { SideNavStateController } from "./side-nav-state";

/** A visual divider for separating navigation items in the side navigation. */
@customElement("bit-nav-divider")
export class BitNavDivider extends BitElement {
  static styles = [
    BitElement.styles,
    css`
      :host {
        display: block;
      }
    `,
  ];

  private readonly nav = new SideNavStateController(this);

  render() {
    return this.nav.state.open
      ? html`<div class="tw-h-px tw-w-full tw-my-2 tw-bg-border-nav-divider"></div>`
      : nothing;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-nav-divider": BitNavDivider;
  }
}
