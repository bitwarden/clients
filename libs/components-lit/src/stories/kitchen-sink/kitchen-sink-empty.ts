import { html } from "lit";
import { customElement } from "lit/decorators.js";

import { NoFolders } from "@bitwarden/assets/svg";

import { typography } from "../../typography/typography";
import "../../status-lockup/status-lockup";
import "../../svg/svg";

import { KitchenSinkElement } from "./kitchen-sink-element";

/** @internal Stories only. */
@customElement("bit-kitchen-sink-empty")
export class KitchenSinkEmpty extends KitchenSinkElement {
  render() {
    return html`
      <div class="tw-flex tw-items-center tw-justify-center tw-min-h-96 tw-flex-col">
        <h2 class=${typography("h2")}>A Page with Content</h2>
        <bit-status-lockup>
          <bit-svg slot="graphic" .content=${NoFolders}></bit-svg>
          <span slot="title">No items to display</span>
          <span slot="description">
            This is an example of an empty state using the bit-status-lockup component.
          </span>
        </bit-status-lockup>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-kitchen-sink-empty": KitchenSinkEmpty;
  }
}
