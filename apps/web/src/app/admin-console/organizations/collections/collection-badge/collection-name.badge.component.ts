// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, Input } from "@angular/core";

import { CollectionView } from "@bitwarden/admin-console/common";

@Component({
  selector: "app-collection-badge",
  templateUrl: "collection-name-badge.component.html",
})
export class CollectionNameBadgeComponent {
  @Input() collectionIds: string[];
  @Input() collections: CollectionView[];

  get shownCollections(): string[] {
    return this.showXMore ? this.collectionIds.slice(0, 2) : this.collectionIds;
  }

  get showXMore(): boolean {
    return this.collectionIds.length > 3;
  }

  get xMoreCount(): number {
    return this.collectionIds.length - 2;
  }
}
