import { html } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { PasswordManagerLogo } from "@bitwarden/assets/svg";

import { closeAllDialogs } from "../../dialog/dialog-service";
import { storyNavState } from "../../navigation/story-helpers";
import "../../layout/layout";
import "../../navigation/nav-group";
import "../../navigation/nav-item";
import "../../navigation/nav-logo";
import "../../navigation/side-nav";

import { KitchenSinkElement, KitchenSinkRoute } from "./kitchen-sink-element";
import "./kitchen-sink-main";

const ROUTES: readonly KitchenSinkRoute[] = ["bitwarden", "empty", "virtual-scroll"];

/** `#/empty` → `"empty"`. Anything else falls back to the vault, like the Angular redirect. */
function routeFromHash(): KitchenSinkRoute {
  const path = window.location.hash.replace(/^#\/?/, "");
  return ROUTES.find((route) => route === path) ?? "bitwarden";
}

/**
 * The kitchen sink app: a `bit-layout` with side nav and a tiny hash router, in place of Angular's
 * `RouterModule.forRoot(..., { useHash: true })`.
 *
 * @internal Stories only.
 */
@customElement("bit-kitchen-sink-app")
export class KitchenSinkApp extends KitchenSinkElement {
  /** Renders the pre-VFO1 design (the `VFO1Foundation` flag off). */
  @property({ type: Boolean }) legacy = false;

  @state() private route: KitchenSinkRoute = "bitwarden";

  private readonly navState = storyNavState();

  private readonly onHashChange = () => (this.route = routeFromHash());

  connectedCallback() {
    super.connectedCallback();
    // Start every story at the vault: the preview iframe keeps the previous story's hash.
    if (window.location.hash.startsWith("#/")) {
      history.replaceState(history.state, "", window.location.pathname + window.location.search);
    }
    this.route = "bitwarden";
    this.tour.end();
    window.addEventListener("hashchange", this.onHashChange);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener("hashchange", this.onHashChange);
    closeAllDialogs();
    this.tour.end();
  }

  render() {
    const homeId = `${this.uid}-home`;
    return html`
      <bit-layout ?legacy=${this.legacy} .sideNavState=${this.navState}>
        <bit-side-nav>
          <bit-nav-logo
            .openIcon=${PasswordManagerLogo}
            href="#/"
            label="Kitchen Sink"
          ></bit-nav-logo>
          <bit-nav-item
            id=${homeId}
            text="Home"
            href="#/bitwarden"
            icon="bwi-vault"
            ?active=${this.route === "bitwarden"}
          ></bit-nav-item>
          <bit-nav-group text="Examples" icon="bwi-cog" open>
            <bit-nav-item
              text="Virtual Scroll"
              href="#/virtual-scroll"
              icon="bwi-list"
              ?active=${this.route === "virtual-scroll"}
            ></bit-nav-item>
          </bit-nav-group>
        </bit-side-nav>
        <bit-kitchen-sink-main .route=${this.route} ?legacy=${this.legacy}></bit-kitchen-sink-main>
      </bit-layout>

      ${this.tourPopover({
        step: 4,
        anchor: homeId,
        heading: "Step 4: Side Nav",
        position: "right-center",
        last: true,
        body: html`<div>
            The <strong>Home</strong> page will take you back to where you started.
          </div>
          <p class="tw-mt-2 tw-mb-0">It's a very cool and helpful page.</p>`,
      })}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-kitchen-sink-app": KitchenSinkApp;
  }
}
