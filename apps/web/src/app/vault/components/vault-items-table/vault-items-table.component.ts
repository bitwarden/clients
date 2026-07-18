import { SelectionModel } from "@angular/cdk/collections";
import { ChangeDetectionStrategy, Component, computed, input, output } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import {
  BitCellComponent,
  BitCellDefDirective,
  BitColumnComponent,
  BitHeaderCellComponent,
  BitTableV2Component,
  BulkActionComponent,
  BulkActionsBarComponent,
  IconButtonModule,
  IconModule,
  LinkModule,
  MenuModule,
  SortFn,
  TableDataSource,
} from "@bitwarden/components";
import { OrganizationNameBadgeComponent } from "@bitwarden/vault";

import { CollectionNameBadgeComponent } from "../../../admin-console/organizations/collections";
import { GroupBadgeModule } from "../../../admin-console/organizations/collections/group-badge/group-badge.module";
import { GroupView } from "../../../admin-console/organizations/core";

import { compareNames, prioritizeCollections, RowHeight, VaultColumn, VaultRow } from "./vault-row";

/** Which vault context the table is rendering; selects the column set. */
export type VaultItemsTableMode = "individual" | "organization";

/** Columns shown per {@link VaultItemsTableMode}. */
const COLUMNS_BY_MODE: Record<VaultItemsTableMode, string[]> = {
  individual: [VaultColumn.Name, VaultColumn.Owner, VaultColumn.Actions],
  organization: [
    VaultColumn.Name,
    VaultColumn.Collections,
    VaultColumn.Groups,
    VaultColumn.Permissions,
    VaultColumn.Actions,
  ],
};

/**
 * Single configurable vault items table built on `bit-table-v2`. One component
 * serves both the personal and organization vaults; the context is expressed
 * through configuration:
 *
 * - `[mode]` selects the column set (`individual` vs `organization`).
 * - `show*` inputs pick which bulk actions appear in the bar.
 * - per-row capability flags on the row gate the per-row actions menu.
 *
 * All columns are declared inline here rather than as separate components: with
 * a single table there's nothing to share them with, and using the typed
 * `dataSource().columns.x` directly keeps `let row` precisely typed as VaultRow
 * with no `[ds]` plumbing. Dumb otherwise: data/selection/lookups in; row
 * activation, per-row, and bulk actions out.
 */
@Component({
  selector: "app-vault-items-table",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    JslibModule,
    IconModule,
    IconButtonModule,
    LinkModule,
    MenuModule,
    BitTableV2Component,
    BitColumnComponent,
    BitHeaderCellComponent,
    BitCellComponent,
    BitCellDefDirective,
    BulkActionsBarComponent,
    BulkActionComponent,
    OrganizationNameBadgeComponent,
    CollectionNameBadgeComponent,
    GroupBadgeModule,
  ],
  template: `
    <bit-table-v2
      [dataSource]="dataSource()"
      [selection]="selection()"
      [displayedColumns]="displayedColumns()"
      [rowSize]="rowSize()"
    >
      <bit-bulk-actions-bar>
        @if (isIndividual()) {
          <bit-bulk-action [action]="onBulkMove" [label]="'addToFolder' | i18n" icon="bwi-folder" />
          <bit-bulk-action
            [action]="onBulkArchive"
            [label]="'archiveVerb' | i18n"
            icon="bwi-archive"
          />
        }
        @if (isOrganization()) {
          <bit-bulk-action
            [action]="onBulkEditAccess"
            [label]="'editAccess' | i18n"
            icon="bwi-users"
          />
          <bit-bulk-action
            [action]="onBulkAssignToCollections"
            [label]="'assignToCollections' | i18n"
            icon="bwi-collection-shared"
          />
        }
        <bit-bulk-action [action]="onBulkDelete" [label]="'delete' | i18n" icon="bwi-trash" />
      </bit-bulk-actions-bar>

      <!-- Name -->
      <bit-column sortable defaultSort="asc" [sortFn]="sortByName" width="minmax(240px, 3fr)">
        <bit-header-cell>{{ "name" | i18n }}</bit-header-cell>
        <bit-cell *bitCellDef="dataSource().columns.name; let row">
          @if (row.cipher; as cipher) {
            <app-vault-icon slot="start" [cipher]="cipher" />
          } @else {
            <bit-icon slot="start" name="bwi-collection-shared" class="tw-text-muted" />
          }
          <button
            bitLink
            linkType="primary"
            type="button"
            [disabled]="disabled()"
            (click)="rowClick.emit(row)"
          >
            {{ row.name }}
          </button>
          @if (row.subtitle; as subtitle) {
            <span slot="secondary">{{ subtitle }}</span>
          }
        </bit-cell>
      </bit-column>

      <!-- Owner -->
      <bit-column width="2fr">
        <bit-header-cell>{{ "owner" | i18n }}</bit-header-cell>
        <bit-cell *bitCellDef="dataSource().columns.organizationId; let row">
          <app-org-badge
            [organizationId]="row.organizationId"
            [organizationName]="organizationName(row.organizationId)"
            [disabled]="disabled()"
          />
        </bit-cell>
      </bit-column>

      <!-- Collections (cipher rows) -->
      <bit-column width="2fr">
        <bit-header-cell>{{ "collections" | i18n }}</bit-header-cell>
        <bit-cell *bitCellDef="dataSource().columns.collectionIds; let row">
          @if (row.collectionIds; as collectionIds) {
            <app-collection-badge
              [collectionIds]="collectionIds"
              [collections]="allCollections()"
            />
          }
        </bit-cell>
      </bit-column>

      <!-- Groups (collection rows) -->
      <bit-column sortable [sortFn]="sortByGroups" width="2fr">
        <bit-header-cell>{{ "groups" | i18n }}</bit-header-cell>
        <bit-cell *bitCellDef="dataSource().columns.groups; let row">
          @if (row.groups; as groups) {
            <app-group-badge [selectedGroups]="groups" [allGroups]="allGroups()" />
          }
        </bit-cell>
      </bit-column>

      <!-- Permissions -->
      <bit-column sortable [sortFn]="sortByPermission" width="2fr">
        <bit-header-cell>{{ "permission" | i18n }}</bit-header-cell>
        <bit-cell *bitCellDef="dataSource().columns.permissionText; let row">
          {{ row.permissionText }}
        </bit-cell>
      </bit-column>

      <!-- Actions -->
      <bit-column width="3.5rem">
        <bit-header-cell></bit-header-cell>
        <bit-cell *bitCellDef="dataSource().synthetic(actionsKey); let row">
          <button
            bitIconButton="bwi-ellipsis-v"
            size="small"
            type="button"
            [bitMenuTriggerFor]="menu"
            [label]="'options' | i18n"
          ></button>
          <bit-menu #menu>
            @if (row.canEdit) {
              <button type="button" bitMenuItem (click)="edit.emit(row)">
                {{ "edit" | i18n }}
              </button>
            }
            @if (isIndividual() && row.canArchive) {
              <button type="button" bitMenuItem (click)="archive.emit(row)">
                {{ "archiveVerb" | i18n }}
              </button>
            }
            @if (isOrganization() && row.canEditAccess) {
              <button type="button" bitMenuItem (click)="editAccess.emit(row)">
                {{ "editAccess" | i18n }}
              </button>
            }
            @if (row.canDelete) {
              <button type="button" bitMenuItem (click)="delete.emit(row)">
                {{ "delete" | i18n }}
              </button>
            }
          </bit-menu>
        </bit-cell>
      </bit-column>
    </bit-table-v2>
  `,
})
export class VaultItemsTableComponent {
  readonly dataSource = input.required<TableDataSource<VaultRow>>();
  readonly selection = input.required<SelectionModel<VaultRow>>();
  readonly mode = input<VaultItemsTableMode>("individual");
  readonly allOrganizations = input<Organization[]>([]);
  readonly allCollections = input<CollectionView[]>([]);
  readonly allGroups = input<GroupView[]>([]);
  readonly disabled = input(false);
  readonly rowSize = input(RowHeight);

  readonly rowClick = output<VaultRow>();

  /** Bulk actions — emit the current selection. */
  readonly bulkMove = output<VaultRow[]>();
  readonly bulkArchive = output<VaultRow[]>();
  readonly bulkEditAccess = output<VaultRow[]>();
  readonly bulkAssignToCollections = output<VaultRow[]>();
  readonly bulkDelete = output<VaultRow[]>();

  /** Per-row actions — emit the single row. */
  readonly edit = output<VaultRow>();
  readonly archive = output<VaultRow>();
  readonly editAccess = output<VaultRow>();
  readonly delete = output<VaultRow>();

  protected readonly displayedColumns = computed(() => COLUMNS_BY_MODE[this.mode()]);
  protected readonly isIndividual = computed(() => this.mode() === "individual");
  protected readonly isOrganization = computed(() => this.mode() === "organization");

  protected readonly actionsKey = VaultColumn.Actions;

  /** Collections before ciphers, then alphabetically by name. */
  protected readonly sortByName: SortFn = (a: VaultRow, b: VaultRow) => {
    const byKind = prioritizeCollections(a, b);
    return byKind !== 0 ? byKind : compareNames(a, b);
  };

  /** Collections before ciphers, then by permission weight (desc-friendly), then by name. */
  protected readonly sortByPermission: SortFn = (a: VaultRow, b: VaultRow) => {
    const byKind = prioritizeCollections(a, b);
    if (byKind !== 0) {
      return byKind;
    }
    const priorityA = a.permissionPriority ?? -1;
    const priorityB = b.permissionPriority ?? -1;
    return priorityA !== priorityB ? priorityA - priorityB : compareNames(a, b);
  };

  /** Collections before ciphers, then by first group name (resolved via allGroups). */
  protected readonly sortByGroups: SortFn = (a: VaultRow, b: VaultRow) => {
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

  protected organizationName(organizationId: string | undefined): string {
    return this.allOrganizations().find((o) => String(o.id) === organizationId)?.name ?? "";
  }

  protected readonly onBulkMove = () => this.bulkMove.emit(this.selection().selected);
  protected readonly onBulkArchive = () => this.bulkArchive.emit(this.selection().selected);
  protected readonly onBulkEditAccess = () => this.bulkEditAccess.emit(this.selection().selected);
  protected readonly onBulkAssignToCollections = () =>
    this.bulkAssignToCollections.emit(this.selection().selected);
  protected readonly onBulkDelete = () => this.bulkDelete.emit(this.selection().selected);

  private firstGroupName(row: VaultRow): string | undefined {
    if (row.groups == null || row.groups.length === 0) {
      return undefined;
    }
    return row.groups
      .map((group) => this.allGroups().find((g) => String(g.id) === String(group.id))?.name ?? "")
      .sort()[0];
  }
}
