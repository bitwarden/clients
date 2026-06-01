import { SelectionModel } from "@angular/cdk/collections";
import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import {
  BitTableV2Component,
  BulkActionComponent,
  BulkActionsBarComponent,
  TableDataSource,
} from "@bitwarden/components";

import { VaultIndividualActionsColumnComponent } from "./vault-individual-actions-column.component";
import { VaultNameColumnComponent } from "./vault-name-column.component";
import { VaultOwnerColumnComponent } from "./vault-owner-column.component";
import { IndividualVaultRow, RowHeight, VaultColumn } from "./vault-row";

/**
 * Individual (personal) vault items table: name, owner, actions, plus the bulk
 * actions bar. A dumb composition of the shared `vault-*-column` components over
 * a `bit-table-v2`. No services — rows, selection, and lookups come in; row
 * activation, per-row actions, and bulk actions go out as events.
 *
 * Both the bulk and per-row action *sets* are fixed for this table (a per-table
 * concern). Bulk actions emit the selected rows and can be disabled via inputs;
 * per-row actions emit the single row. The bar reads selection state from the
 * enclosing `bit-table-v2` automatically.
 */
@Component({
  selector: "app-individual-vault-items-table",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    JslibModule,
    BitTableV2Component,
    BulkActionsBarComponent,
    BulkActionComponent,
    VaultNameColumnComponent,
    VaultOwnerColumnComponent,
    VaultIndividualActionsColumnComponent,
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
          [action]="onBulkMove"
          [label]="'addToFolder' | i18n"
          icon="bwi-folder"
          [disabled]="bulkMoveDisabled()"
        />
        <bit-bulk-action
          [action]="onBulkArchive"
          [label]="'archiveVerb' | i18n"
          icon="bwi-archive"
          [disabled]="bulkArchiveDisabled()"
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
      <vault-owner-column
        [ds]="dataSource()"
        [allOrganizations]="allOrganizations()"
        [disabled]="disabled()"
      />
      <vault-individual-actions-column
        [ds]="dataSource()"
        (edit)="edit.emit($event)"
        (archive)="archive.emit($event)"
        (delete)="delete.emit($event)"
      />
    </bit-table-v2>
  `,
})
export class IndividualVaultItemsTableComponent {
  readonly dataSource = input.required<TableDataSource<IndividualVaultRow>>();
  readonly selection = input.required<SelectionModel<IndividualVaultRow>>();
  readonly allOrganizations = input<Organization[]>([]);
  readonly disabled = input(false);
  readonly rowSize = input(RowHeight);

  readonly bulkMoveDisabled = input(false);
  readonly bulkArchiveDisabled = input(false);
  readonly bulkDeleteDisabled = input(false);

  readonly rowClick = output<IndividualVaultRow>();

  /** Bulk actions — emit the current selection. */
  readonly bulkMove = output<IndividualVaultRow[]>();
  readonly bulkArchive = output<IndividualVaultRow[]>();
  readonly bulkDelete = output<IndividualVaultRow[]>();

  /** Per-row actions — emit the single row. */
  readonly edit = output<IndividualVaultRow>();
  readonly archive = output<IndividualVaultRow>();
  readonly delete = output<IndividualVaultRow>();

  protected readonly displayedColumns = [VaultColumn.Name, VaultColumn.Owner, VaultColumn.Actions];

  protected readonly onBulkMove = () => this.bulkMove.emit(this.selection().selected);
  protected readonly onBulkArchive = () => this.bulkArchive.emit(this.selection().selected);
  protected readonly onBulkDelete = () => this.bulkDelete.emit(this.selection().selected);
}
