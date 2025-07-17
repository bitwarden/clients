import { Component, OnChanges, input } from "@angular/core";

import { I18nPipe } from "@bitwarden/ui-common";

import { BadgeModule, BadgeVariant } from "../badge";

function transformMaxItems(value: number | undefined) {
  return value == undefined ? undefined : Math.max(1, value);
}

@Component({
  selector: "bit-badge-list",
  templateUrl: "badge-list.component.html",
  imports: [BadgeModule, I18nPipe],
})
export class BadgeListComponent implements OnChanges {
  protected filteredItems: string[] = [];
  protected isFiltered = false;

  readonly variant = input<BadgeVariant>("primary");
  readonly items = input<string[]>([]);
  readonly truncate = input(true);

  readonly maxItems = input(undefined, { transform: transformMaxItems });

  ngOnChanges() {
    const maxItems = this.maxItems();

    if (maxItems == undefined || this.items().length <= maxItems) {
      this.filteredItems = this.items();
    } else {
      this.filteredItems = this.items().slice(0, maxItems - 1);
    }
    this.isFiltered = this.items().length > this.filteredItems.length;
  }
}
