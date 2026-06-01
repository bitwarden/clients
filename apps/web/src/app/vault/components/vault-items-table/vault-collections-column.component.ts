import { ChangeDetectionStrategy, Component, input } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import {
  BitCellComponent,
  BitCellDefDirective,
  BitColumnComponent,
  BitHeaderCellComponent,
  TableDataSource,
} from "@bitwarden/components";

import { CollectionNameBadgeComponent } from "../../../admin-console/organizations/collections";

import { CollectionsColumnRow } from "./vault-row";

/** Collections column: the collection-membership badge for cipher rows. */
@Component({
  selector: "vault-collections-column",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    JslibModule,
    BitColumnComponent,
    BitHeaderCellComponent,
    BitCellComponent,
    BitCellDefDirective,
    CollectionNameBadgeComponent,
  ],
  template: `
    <bit-column width="2fr">
      <bit-header-cell>{{ "collections" | i18n }}</bit-header-cell>
      <bit-cell *bitCellDef="ds().columns.collectionIds; let row">
        @if (row.collectionIds; as collectionIds) {
          <app-collection-badge [collectionIds]="collectionIds" [collections]="allCollections()" />
        }
      </bit-cell>
    </bit-column>
  `,
})
export class VaultCollectionsColumnComponent<T extends CollectionsColumnRow> {
  readonly ds = input.required<TableDataSource<T>>();
  readonly allCollections = input<CollectionView[]>([]);
}
