import { ChangeDetectionStrategy, Component, signal } from "@angular/core";

import { KitchenSinkSharedModule } from "../kitchen-sink-shared.module";

@Component({
  selector: "bit-kitchen-sink-toggle-list",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [KitchenSinkSharedModule],
  template: `
    <div class="tw-my-6">
      <bit-toggle-group
        [selected]="selectedToggle()"
        (selectedChange)="selectedToggle.set($event)"
        aria-label="Company list filter"
      >
        <bit-toggle value="all"> All <bit-berry [value]="3"></bit-berry> </bit-toggle>

        <bit-toggle value="large"> Enterprise <bit-berry [value]="2"></bit-berry> </bit-toggle>

        <bit-toggle value="small"> Mid-sized <bit-berry [value]="1"></bit-berry> </bit-toggle>
      </bit-toggle-group>
    </div>
    @for (company of companyList; track company) {
      <ul>
        @if (company.size === selectedToggle() || selectedToggle() === "all") {
          <li>
            {{ company.name }}
          </li>
        }
      </ul>
    }
  `,
})
export class KitchenSinkToggleListComponent {
  protected readonly selectedToggle = signal<"all" | "large" | "small">("all");

  readonly companyList = [
    { name: "A large enterprise company", size: "large" },
    { name: "Another enterprise company", size: "large" },
    { name: "A smaller company", size: "small" },
  ];
}
