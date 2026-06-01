import { ChangeDetectionStrategy, Component, input } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  BitCellComponent,
  BitCellDefDirective,
  BitColumnComponent,
  BitHeaderCellComponent,
  SortFn,
  TableDataSource,
} from "@bitwarden/components";

import { compareNames, PermissionsColumnRow, prioritizeCollections } from "./vault-row";

/**
 * Permissions column. The text and sort weight are policy-derived, so the
 * consumer resolves `permissionText` / `permissionPriority` onto each row; this
 * column just renders and sorts by them.
 */
@Component({
  selector: "vault-permissions-column",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    JslibModule,
    BitColumnComponent,
    BitHeaderCellComponent,
    BitCellComponent,
    BitCellDefDirective,
  ],
  template: `
    <bit-column sortable [sortFn]="sortFn" width="2fr">
      <bit-header-cell>{{ "permission" | i18n }}</bit-header-cell>
      <bit-cell *bitCellDef="ds().columns.permissionText; let row">{{
        row.permissionText
      }}</bit-cell>
    </bit-column>
  `,
})
export class VaultPermissionsColumnComponent<T extends PermissionsColumnRow> {
  readonly ds = input.required<TableDataSource<T>>();

  /** Collections before ciphers, then by permission weight (desc-friendly), then by name. */
  protected readonly sortFn: SortFn = (a: PermissionsColumnRow, b: PermissionsColumnRow) => {
    const byKind = prioritizeCollections(a, b);
    if (byKind !== 0) {
      return byKind;
    }
    const priorityA = a.permissionPriority ?? -1;
    const priorityB = b.permissionPriority ?? -1;
    return priorityA !== priorityB ? priorityA - priorityB : compareNames(a, b);
  };
}
