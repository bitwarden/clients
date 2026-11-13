import { html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import "../../avatar/avatar";
import "../../banner/banner";
import "../../breadcrumbs/breadcrumb";
import "../../breadcrumbs/breadcrumbs";
import "../../header/header";
import "../../icon/icon";
import "../../layout/page";
import "../../link/link";
import "../../popover/popover";
import "../../search/search";
import "../../tabs/tab-nav-bar/tab-link";
import "../../tabs/tab-nav-bar/tab-nav-bar";

import "./dialog-virtual-scroll-block";
import { KitchenSinkElement, KitchenSinkRoute } from "./kitchen-sink-element";
import "./kitchen-sink-empty";
import "./kitchen-sink-vault";

const navItems = [
  { icon: "bwi-shared-folder", name: "Password Managers", href: "#/" },
  { icon: "bwi-shared-folder", name: "Favorites", href: "#/" },
];

/**
 * The page: banner, header with breadcrumbs, search, avatar and tabs, and the routed content.
 *
 * @internal Stories only.
 */
@customElement("bit-kitchen-sink-main")
export class KitchenSinkMain extends KitchenSinkElement {
  /** The routed child page. */
  @property() route: KitchenSinkRoute = "bitwarden";

  /** Renders the pre-VFO1 header and table. */
  @property({ type: Boolean }) legacy = false;

  @state() private bannerVisible = true;

  private renderOutlet() {
    switch (this.route) {
      case "empty":
        return html`<bit-kitchen-sink-empty></bit-kitchen-sink-empty>`;
      case "virtual-scroll":
        return html`<dialog-virtual-scroll-block></dialog-virtual-scroll-block>`;
      default:
        return html`<bit-kitchen-sink-vault ?legacy=${this.legacy}></bit-kitchen-sink-vault>`;
    }
  }

  render() {
    const helpId = `${this.uid}-help`;
    const searchId = `${this.uid}-search`;
    return html`
      <bit-page>
        ${
          this.bannerVisible
            ? html`<div>
                <bit-banner dismissible @dismiss=${() => (this.bannerVisible = false)}>
                  Bitwarden is the most trusted password manager.
                  <bit-link>Click me</bit-link>
                </bit-banner>
              </div>`
            : nothing
        }
        <bit-header title="Kitchen Sink" icon="bwi-shared-folder" ?legacy=${this.legacy}>
          <bit-breadcrumbs slot="breadcrumbs">
            ${navItems.map(
              (item) =>
                html`<bit-breadcrumb icon=${item.icon} href=${item.href}
                  >${item.name}</bit-breadcrumb
                >`,
            )}
          </bit-breadcrumbs>
          <bit-link
            id=${helpId}
            label="Popover trigger link"
            slot=${this.legacy ? "secondary" : nothing}
          >
            <bit-icon name="bwi-question-circle"></bit-icon>
          </bit-link>
          <bit-search id=${searchId}></bit-search>
          <bit-avatar text="BW"></bit-avatar>
          <bit-tab-nav-bar slot="tabs">
            <bit-tab-link href="#/bitwarden" ?active=${this.route === "bitwarden"}
              >Vault</bit-tab-link
            >
            <bit-tab-link href="#/empty" ?active=${this.route === "empty"}>Empty</bit-tab-link>
          </bit-tab-nav-bar>
        </bit-header>

        ${this.renderOutlet()}
      </bit-page>

      <bit-popover trigger=${helpId} heading="Educational Popover">
        <div>You can learn more things at:</div>
        <ul class="tw-mt-2 tw-mb-0 tw-ps-4">
          <li>Help center</li>
          <li>Support</li>
        </ul>
      </bit-popover>

      ${this.tourPopover({
        step: 1,
        anchor: searchId,
        heading: "Step 1: Search",
        position: "below-center",
        body: html`<div>
            Use the <strong>search bar</strong> to quickly find any item in your vault.
          </div>
          <p class="tw-mt-2 tw-mb-0">
            Search works across all fields including usernames, URLs, and notes.
          </p>`,
      })}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-kitchen-sink-main": KitchenSinkMain;
  }
}
