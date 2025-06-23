// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore

import { Component, Input, OnChanges, input } from "@angular/core";

import { I18nPipe } from "@bitwarden/ui-common";

import { BadgeModule, BadgeVariant } from "../badge";

@Component({
  selector: "bit-badge-list",
  templateUrl: "badge-list.component.html",
  imports: [BadgeModule, I18nPipe],
})
export class BadgeListComponent implements OnChanges {
  private _maxItems: number;

  protected filteredItems: string[] = [];
  protected isFiltered = false;

  readonly variant = input<BadgeVariant>("primary");
  readonly items = input<string[]>([]);
  readonly truncate = input(true);

  // TODO: Skipped for migration because:
  //  Accessor inputs cannot be migrated as they are too complex.
  @Input()
  get maxItems(): number | undefined {
    return this._maxItems;
  }

  set maxItems(value: number | undefined) {
    this._maxItems = value == undefined ? undefined : Math.max(1, value);
  }

  ngOnChanges() {
    if (this.maxItems == undefined || this.items().length <= this.maxItems) {
      this.filteredItems = this.items();
    } else {
      this.filteredItems = this.items().slice(0, this.maxItems - 1);
    }
    this.isFiltered = this.items().length > this.filteredItems.length;
  }
}
