import { Component } from "@angular/core";

import { KitchenSinkSharedModule } from "../kitchen-sink-shared.module";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "bit-kitchen-sink-toggle-list",
  imports: [KitchenSinkSharedModule],
  template: `
    <div class="tw-my-6">
      <bit-toggle-group [(selected)]="selectedToggle" aria-label="Company list filter">
        <bit-toggle value="all"> All <bit-berry [value]="3"></bit-berry> </bit-toggle>

        <bit-toggle value="large"> Enterprise <bit-berry [value]="2"></bit-berry> </bit-toggle>

        <bit-toggle value="small"> Mid-sized <bit-berry [value]="1"></bit-berry> </bit-toggle>
      </bit-toggle-group>
    </div>
    @for (company of companyList; track company) {
      <ul>
        @if (company.size === selectedToggle || selectedToggle === "all") {
          <li>
            {{ company.name }}
          </li>
        }
      </ul>
    }
  `,
})
export class KitchenSinkToggleListComponent {
  selectedToggle: "all" | "large" | "small" = "all";

  companyList = [
    { name: "A large enterprise company", size: "large" },
    { name: "Another enterprise company", size: "large" },
    { name: "A smaller company", size: "small" },
  ];
}
