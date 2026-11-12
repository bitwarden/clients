import { html, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";

import "../../berry/berry";
import "../../toggle-group/toggle";
import "../../toggle-group/toggle-group";

import { KitchenSinkElement } from "./kitchen-sink-element";

type CompanySize = "all" | "large" | "small";

const companyList = [
  { name: "A large enterprise company", size: "large" },
  { name: "Another enterprise company", size: "large" },
  { name: "A smaller company", size: "small" },
];

/** @internal Stories only. */
@customElement("bit-kitchen-sink-toggle-list")
export class KitchenSinkToggleList extends KitchenSinkElement {
  @state() private selectedToggle: CompanySize = "all";

  render() {
    return html`
      <div class="tw-my-6">
        <bit-toggle-group
          .selected=${this.selectedToggle}
          @selectedChange=${(e: CustomEvent<CompanySize>) => (this.selectedToggle = e.detail)}
          label="Company list filter"
        >
          <bit-toggle value="all">All <bit-berry value="3"></bit-berry></bit-toggle>
          <bit-toggle value="large">Enterprise <bit-berry value="2"></bit-berry></bit-toggle>
          <bit-toggle value="small">Mid-sized <bit-berry value="1"></bit-berry></bit-toggle>
        </bit-toggle-group>
      </div>
      ${companyList.map(
        (company) =>
          html`<ul>
            ${
              company.size === this.selectedToggle || this.selectedToggle === "all"
                ? html`<li>${company.name}</li>`
                : nothing
            }
          </ul>`,
      )}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-kitchen-sink-toggle-list": KitchenSinkToggleList;
  }
}
