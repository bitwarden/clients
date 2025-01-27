// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore

import { Component, Input, OnChanges } from "@angular/core";

import { I18nPipe } from "@bitwarden/ui-common";

import { BadgeModule, BadgeVariant } from "../badge";

@Component({
  selector: "bit-badge-list",
  templateUrl: "badge-list.component.html",
  standalone: true,
  imports: [BadgeModule, I18nPipe],
})
export class BadgeListComponent implements OnChanges {
  private _maxItems: number;

  protected filteredItems: string[] = [];
  protected isFiltered = false;

  @Input() variant: BadgeVariant = "primary";
  @Input() items: string[] = [];
  @Input() truncate = true;

  @Input()
  get maxItems(): number | undefined {
    return this._maxItems;
  }

  set maxItems(value: number | undefined) {
    this._maxItems = value == undefined ? undefined : Math.max(1, value);
  }

  ngOnChanges() {
    if (this.maxItems == undefined || this.items.length <= this.maxItems) {
      this.filteredItems = this.items;
    } else {
      this.filteredItems = this.items.slice(0, this.maxItems - 1);
    }
    this.isFiltered = this.items.length > this.filteredItems.length;
  }
}
