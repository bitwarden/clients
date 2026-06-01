import { SelectionModel } from "@angular/cdk/collections";
import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import {
  BitTableV2Component,
  BulkActionComponent,
  BulkActionsBarComponent,
  TableDataSource,
} from "@bitwarden/components";

import { GroupView } from "../../../admin-console/organizations/core";

import { VaultCollectionsColumnComponent } from "./vault-collections-column.component";
import { VaultGroupsColumnComponent } from "./vault-groups-column.component";
import { VaultNameColumnComponent } from "./vault-name-column.component";
import { VaultOrgActionsColumnComponent } from "./vault-org-actions-column.component";
import { VaultPermissionsColumnComponent } from "./vault-permissions-column.component";
import { OrgVaultRow, RowHeight, VaultColumn } from "./vault-row";

/**
 * Organization vault items table: name, collections, groups, permissions,
 * actions, plus the bulk actions bar. A dumb composition of the shared
 * `vault-*-column` components over a `bit-table-v2`. No services — rows,
 * selection, and lookups come in; row activation, per-row actions, and bulk
 * actions go out as events.
 *
 * Both the bulk and per-row action *sets* are fixed for this table (a per-table
 * concern). Bulk actions emit the selected rows and can be disabled via inputs;
 * per-row actions emit the single row. The bar reads selection state from the
 * enclosing `bit-table-v2` automatically.
 */
@Component({
  selector: "app-org-vault-items-table",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    JslibModule,
    BitTableV2Component,
    BulkActionsBarComponent,
    BulkActionComponent,
    VaultNameColumnComponent,
    VaultCollectionsColumnComponent,
    VaultGroupsColumnComponent,
    VaultPermissionsColumnComponent,
    VaultOrgActionsColumnComponent,
  ],
  template: `
    <bit-table-v2
      [dataSource]="dataSource()"
      [selection]="selection()"
      [displayedColumns]="displayedColumns"
      [rowSize]="rowSize()"
    >
      <bit-bulk-actions-bar>
        <bit-bulk-action
          [action]="onBulkEditAccess"
          [label]="'editAccess' | i18n"
          icon="bwi-users"
          [disabled]="bulkEditAccessDisabled()"
        />
        <bit-bulk-action
          [action]="onBulkAssignToCollections"
          [label]="'assignToCollections' | i18n"
          icon="bwi-collection-shared"
          [disabled]="bulkAssignToCollectionsDisabled()"
        />
        <bit-bulk-action
          [action]="onBulkDelete"
          [label]="'delete' | i18n"
          icon="bwi-trash"
          [disabled]="bulkDeleteDisabled()"
        />
      </bit-bulk-actions-bar>

      <vault-name-column
        [ds]="dataSource()"
        [disabled]="disabled()"
        (rowClick)="rowClick.emit($event)"
      />
      <vault-collections-column [ds]="dataSource()" [allCollections]="allCollections()" />
      <vault-groups-column [ds]="dataSource()" [allGroups]="allGroups()" />
      <vault-permissions-column [ds]="dataSource()" />
      <vault-org-actions-column
        [ds]="dataSource()"
        (edit)="edit.emit($event)"
        (editAccess)="editAccess.emit($event)"
        (delete)="delete.emit($event)"
      />
    </bit-table-v2>
  `,
})
export class OrgVaultItemsTableComponent {
  readonly dataSource = input.required<TableDataSource<OrgVaultRow>>();
  readonly selection = input.required<SelectionModel<OrgVaultRow>>();
  readonly allCollections = input<CollectionView[]>([]);
  readonly allGroups = input<GroupView[]>([]);
  readonly disabled = input(false);
  readonly rowSize = input(RowHeight);

  readonly bulkEditAccessDisabled = input(false);
  readonly bulkAssignToCollectionsDisabled = input(false);
  readonly bulkDeleteDisabled = input(false);

  readonly rowClick = output<OrgVaultRow>();

  /** Bulk actions — emit the current selection. */
  readonly bulkEditAccess = output<OrgVaultRow[]>();
  readonly bulkAssignToCollections = output<OrgVaultRow[]>();
  readonly bulkDelete = output<OrgVaultRow[]>();

  /** Per-row actions — emit the single row. */
  readonly edit = output<OrgVaultRow>();
  readonly editAccess = output<OrgVaultRow>();
  readonly delete = output<OrgVaultRow>();

  protected readonly displayedColumns = [
    VaultColumn.Name,
    VaultColumn.Collections,
    VaultColumn.Groups,
    VaultColumn.Permissions,
    VaultColumn.Actions,
  ];

  protected readonly onBulkEditAccess = () => this.bulkEditAccess.emit(this.selection().selected);
  protected readonly onBulkAssignToCollections = () =>
    this.bulkAssignToCollections.emit(this.selection().selected);
  protected readonly onBulkDelete = () => this.bulkDelete.emit(this.selection().selected);
}
