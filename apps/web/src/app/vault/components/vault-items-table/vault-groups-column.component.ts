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

import { GroupBadgeModule } from "../../../admin-console/organizations/collections/group-badge/group-badge.module";
import { GroupView } from "../../../admin-console/organizations/core";

import { GroupsColumnRow, prioritizeCollections } from "./vault-row";

/**
 * Groups column: the group-access badge for collection rows. Sorting needs the
 * `allGroups` lookup to resolve names, so the comparator lives here (closing
 * over the input) rather than as a pure function on the row.
 */
@Component({
  selector: "vault-groups-column",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    JslibModule,
    BitColumnComponent,
    BitHeaderCellComponent,
    BitCellComponent,
    BitCellDefDirective,
    GroupBadgeModule,
  ],
  template: `
    <bit-column sortable [sortFn]="sortFn" width="2fr">
      <bit-header-cell>{{ "groups" | i18n }}</bit-header-cell>
      <bit-cell *bitCellDef="ds().columns.groups; let row">
        @if (row.groups; as groups) {
          <app-group-badge [selectedGroups]="groups" [allGroups]="allGroups()" />
        }
      </bit-cell>
    </bit-column>
  `,
})
export class VaultGroupsColumnComponent<T extends GroupsColumnRow> {
  readonly ds = input.required<TableDataSource<T>>();
  readonly allGroups = input<GroupView[]>([]);

  // Collections sort before ciphers; among collections, those with groups first, then by name.
  protected readonly sortFn: SortFn = (a: GroupsColumnRow, b: GroupsColumnRow) => {
    const byKind = prioritizeCollections(a, b);
    if (byKind !== 0) {
      return byKind;
    }
    const aName = this.firstGroupName(a);
    const bName = this.firstGroupName(b);
    if (aName == null) {
      return 1;
    }
    if (bName == null) {
      return -1;
    }
    return aName.localeCompare(bName);
  };

  private firstGroupName(row: GroupsColumnRow): string | undefined {
    if (row.groups == null || row.groups.length === 0) {
      return undefined;
    }
    const names = row.groups
      .map((group) => this.allGroups().find((g) => String(g.id) === String(group.id))?.name ?? "")
      .sort();
    return names[0];
  }
}
