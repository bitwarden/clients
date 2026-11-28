import { ContextConsumer, ContextProvider } from "@lit/context";
import { css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

import { BitElement } from "../core/bit-element";
import { uniqueId } from "../core/ids";
import type { BitwardenIcon } from "../icon/shared-icon";

import { navGroupContext, NavToggleScope, navToggleScopeContext } from "./nav-context";
import { SideNavStateController } from "./side-nav-state";
import "../icon/icon";

/**
 * A titled section grouping for the side navigation. Renders an uppercase heading and
 * semantically groups the slotted nav items beneath it. When the side nav is collapsed the
 * heading is visually hidden (sr-only) while the grouped items keep their icons visible in the rail.
 *
 * @slot - Nav items, groups, or a `bit-nav-section-empty`.
 */
@customElement("bit-nav-section")
export class BitNavSection extends BitElement {
  static styles = [
    BitElement.styles,
    css`
      :host {
        display: block;
      }
    `,
  ];

  /** Section heading text, e.g. "Manage". Displayed uppercased via CSS. */
  @property() label = "";

  /** Optional icon rendered before the label, e.g. "bwi-folder". */
  @property() icon?: BitwardenIcon;

  private readonly nav = new SideNavStateController(this);
  private readonly parentGroup = new ContextConsumer(this, {
    context: navGroupContext,
    subscribe: true,
  });
  private readonly labelId = uniqueId("bit-nav-section");

  constructor() {
    super();
    new ContextProvider(this, navToggleScopeContext, new NavToggleScope());
  }

  render() {
    const open = this.nav.state.open;
    const inGroup = !!this.parentGroup.value;
    return html`<div role="group" aria-labelledby=${this.labelId}>
      <div
        id=${this.labelId}
        class="tw-flex tw-items-center tw-gap-1 tw-pe-3 tw-pt-1 tw-mb-0.5 tw-text-xs tw-font-semibold tw-uppercase tw-tracking-[1px] tw-text-fg-nav-heading ${
          inGroup ? "tw-ps-3" : "tw-ps-2"
        } ${open ? "" : "tw-sr-only"}"
      >
        ${
          this.icon
            ? html`<bit-icon class="tw-text-base/none" name=${this.icon}></bit-icon>`
            : nothing
        }
        <span>${this.label}</span>
      </div>
      <div class="tw-flex tw-flex-col tw-gap-0.5">
        <slot></slot>
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-nav-section": BitNavSection;
  }
}
