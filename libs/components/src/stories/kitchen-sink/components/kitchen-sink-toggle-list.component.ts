import { Component } from "@angular/core";

import { KitchenSinkSharedModule } from "../kitchen-sink-shared.module";

@Component({
  standalone: true,
  selector: "bit-kitchen-sink-toggle-list",
  imports: [KitchenSinkSharedModule],
  template: `
    <div class="tw-my-6">
      <bit-toggle-group [(selected)]="selectedToggle" aria-label="Company list filter">
        <bit-toggle value="all"> All <span bitBadge variant="info">3</span> </bit-toggle>

        <bit-toggle value="large"> Enterprise <span bitBadge variant="info">2</span> </bit-toggle>

        <bit-toggle value="small"> Mid-sized <span bitBadge variant="info">1</span> </bit-toggle>
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
export class KitchenSinkToggleList {
  selectedToggle: "all" | "large" | "small" = "all";

  companyList = [
    { name: "A large enterprise company", size: "large" },
    { name: "Another enterprise company", size: "large" },
    { name: "A smaller company", size: "small" },
  ];
}
