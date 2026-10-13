import { TemplatePortal } from "@angular/cdk/portal";
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  TemplateRef,
  TrackByFunction,
  untracked,
  viewChild,
  ViewContainerRef,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { RouterLink } from "@angular/router";
import { combineLatest, map, switchMap } from "rxjs";

// eslint-disable-next-line no-restricted-imports
import { CollectionService } from "@bitwarden/admin-console/common";
import { NoFolders, NoResults } from "@bitwarden/assets/svg";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { filterOutNullish } from "@bitwarden/common/vault/utils/observable-utilities";
import {
  BitCellComponent,
  BitCellDefDirective,
  BitCellLoadingDirective,
  BitColumnComponent,
  BitHeaderCellComponent,
  BitTableToolbarComponent,
  BitTableV2Component,
  BulkActionComponent,
  BulkActionsBarComponent,
  ButtonModule,
  defineTable,
  FilterControl,
  FilterMenuModule,
  IconButtonModule,
  IconModule,
  IconTileComponent,
  LayoutFooterService,
  LinkModule,
  MenuModule,
  SearchModule,
  SelectionConfig,
  SkeletonTextComponent,
  SortFn,
  StatusLockupComponent,
  SvgComponent,
  TableSelectionModel,
  TooltipDirective,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { vaultScopeCommands, VaultScopeType } from "../../models/vault-scope";
import { BULK_DELETE_DIALOG, BulkDeleteDialogRef } from "../../tokens/bulk-delete-dialog.token";
import {
  BULK_EDIT_COLLECTION_ACCESS_DIALOG,
  BulkEditCollectionAccessDialogRef,
} from "../../tokens/bulk-edit-collection-access-dialog.token";
import {
  COLLECTION_DIALOG,
  CollectionDialogRef,
  CollectionDialogTab,
} from "../../tokens/collection-dialog.token";
import {
  BULK_BAR_CLEARANCE,
  VAULT_TABLE_MIN_HEIGHT,
  VAULT_TABLE_ROW_HEIGHT,
} from "../vault-table-sizing";

import { injectVaultOrganizationId } from "./inject-vault-organization";
import {
  SHARED_FOLDER_PERMISSIONS,
  SharedFolderPermission,
  sharedFolderPermissionMessageKey,
  sharedFolderPermissionOrder,
} from "./shared-folder-permission";
import { SharedFolderRow, sharedFolderRows } from "./shared-folder-rows";

/**
 * Every column the table declares, in display order. Synthetic (`defineTable`'s second type
 * parameter) rather than sourced from the row type, so `table.columns.*` names the columns rather
 * than the row's fields — the two don't line up.
 */
export const SHARED_FOLDERS_COLUMNS = Object.freeze([
  "name",
  "permissions",
  "items",
  "options",
] as const);

export type SharedFoldersTableColumn = (typeof SHARED_FOLDERS_COLUMNS)[number];

/**
 * The `filterValues` key `bit-table-v2` reserves for a projected `bit-search` (its module-private
 * `SEARCH_FILTER_KEY`). Mirrored here so the empty state's Clear all can skip it and clear chip
 * filters only, matching the toolbar's own `clearAll()`.
 */
const SEARCH_FILTER_KEY = "search";

/** The shape of {@link BitTableV2Component.filterValues} for this table. */
export type SharedFoldersTableFilters = {
  /** Reserved key — the table adopts the projected `bit-search` under it automatically. */
  search?: string;

  /**
   * Multi-select: a row matches any selected permission. Holds the permission rather than its
   * label so a URL-synced filter survives a change of locale.
   */
  permissions?: SharedFolderPermission[];
};

/**
 * The top-level shared folders of one organization vault: name (with a count of the folders nested
 * inside), permissions, item count, and a per-row Options menu, with a search field, a Permissions
 * filter chip, an Add button, and a bulk actions bar. Self-contained — it reads the route, loads
 * the folders, and owns its dialogs. Project the client's page header into the default slot:
 *
 * ```html
 * <vault-shared-folders><app-header /></vault-shared-folders>
 * ```
 *
 * Reached at `/vault/:vaultId/shared-folders`, guarded by `organizationVaultGuard`.
 *
 * ## What a client provides
 *
 * Every write goes through a dialog the client supplies as a token, so a client that provides none
 * lists its folders read-only and offers no action it can't carry out — see {@link COLLECTION_DIALOG},
 * {@link BULK_DELETE_DIALOG}, and {@link BULK_EDIT_COLLECTION_ACCESS_DIALOG}. `COLLECTION_DIALOG`
 * gates the single-folder actions as a set: without it the Options column is dropped altogether.
 *
 * Each folder's name links to its organization's vault, drilled into that folder.
 */
@Component({
  selector: "vault-shared-folders",
  templateUrl: "./shared-folders.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "tw-flex tw-flex-col tw-flex-1 tw-min-h-0",
    // Inline rather than a `tw-min-h-*` utility: it has to beat the `tw-min-h-0` above, which
    // otherwise lets the flex parent shrink the table to nothing.
    "[style.minHeight.px]": "minTableHeight",
    "[style.marginBottom.px]": "bulkBarClearance()",
  },
  imports: [
    BitCellComponent,
    BitCellDefDirective,
    BitCellLoadingDirective,
    BitColumnComponent,
    BitHeaderCellComponent,
    BitTableToolbarComponent,
    BitTableV2Component,
    BulkActionComponent,
    BulkActionsBarComponent,
    ButtonModule,
    FilterMenuModule,
    I18nPipe,
    IconButtonModule,
    IconModule,
    IconTileComponent,
    LinkModule,
    MenuModule,
    RouterLink,
    SearchModule,
    SkeletonTextComponent,
    StatusLockupComponent,
    SvgComponent,
    TooltipDirective,
  ],
})
export class SharedFoldersComponent {
  private readonly accountService = inject(AccountService);
  private readonly cipherService = inject(CipherService);
  private readonly collectionService = inject(CollectionService);
  private readonly organizationService = inject(OrganizationService);
  private readonly layoutFooter = inject(LayoutFooterService);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly destroyRef = inject(DestroyRef);

  private readonly bulkBarTemplate = viewChild.required<TemplateRef<unknown>>("bulkBar");

  /** The projected table, for the selection model it owns — see {@link reconcileSelection}. */
  private readonly tableComponent = viewChild(BitTableV2Component<SharedFolderRow>);

  private readonly collectionDialog = inject<CollectionDialogRef>(COLLECTION_DIALOG, {
    optional: true,
  });

  private readonly bulkDeleteDialog = inject<BulkDeleteDialogRef>(BULK_DELETE_DIALOG, {
    optional: true,
  });

  private readonly bulkEditAccessDialog = inject<BulkEditCollectionAccessDialogRef>(
    BULK_EDIT_COLLECTION_ACCESS_DIALOG,
    { optional: true },
  );

  private readonly userId$ = this.accountService.activeAccount$.pipe(getUserId);

  private readonly organizationId = injectVaultOrganizationId();

  /** `undefined` until each stream first emits, which is what drives {@link loading}. */
  private readonly loaded = toSignal(
    this.userId$.pipe(
      switchMap((userId) =>
        combineLatest([
          this.collectionService.decryptedCollections$(userId),
          // Emits null until the first decrypt completes.
          this.cipherService.cipherListViews$(userId).pipe(filterOutNullish()),
          this.organizationService.organizations$(userId),
        ]),
      ),
      map(([collections, ciphers, organizations]) => ({ collections, ciphers, organizations })),
    ),
  );

  protected readonly loading = computed(() => this.loaded() === undefined);

  private readonly organization = computed<Organization | undefined>(() =>
    this.loaded()?.organizations.find((organization) => organization.id === this.organizationId()),
  );

  /** The organization's shared folders — see {@link sharedFolderRows}. */
  protected readonly sharedFolders = computed<SharedFolderRow[]>(() => {
    const organizationId = this.organizationId();
    const data = this.loaded();
    if (organizationId == null || data == null) {
      return [];
    }

    return sharedFolderRows({
      organizationId,
      organization: this.organization(),
      collections: data.collections,
      ciphers: data.ciphers,
    });
  });

  protected readonly table = defineTable<SharedFolderRow, SharedFoldersTableColumn>(
    this.sharedFolders,
  );

  protected readonly trackById: TrackByFunction<SharedFolderRow> = (_index, row) => row.id;

  protected readonly rowHeight = VAULT_TABLE_ROW_HEIGHT;
  protected readonly minTableHeight = VAULT_TABLE_MIN_HEIGHT;

  /**
   * The selected rows, read off the table's own model so a bulk action can be handed the rows it
   * acts on, and the bar its count — it sits outside the table. Read rather than mirrored through
   * `selectedChange`, so it empties with the model when selection turns off — see {@link selection}.
   */
  protected readonly selectedRows = computed<readonly SharedFolderRow[]>(
    () => this.tableComponent()?.selectionModel()?.selected() ?? [],
  );

  /** Bottom margin held while the bulk-actions bar is up. */
  protected readonly bulkBarClearance = computed(() =>
    this.selectedRows().length > 0 ? BULK_BAR_CLEARANCE : 0,
  );

  /**
   * Whether the Options column is offered at all. Gated on the client having a collection dialog
   * rather than on what each row allows, so filtering can't make the column come and go and resize
   * every other column with it.
   */
  protected readonly showOptions = this.collectionDialog != null;

  /**
   * Whether the toolbar offers its Add button, on the organization's own collection creation
   * permission — so this page and the organization vault's Add agree on who may add a folder.
   * `false` while the organization list loads, and for a `:vaultId` that resolves to nothing:
   * either way the dialog would have no organization to save to.
   */
  protected readonly canAdd = computed(
    () => this.showOptions && (this.organization()?.canCreateNewCollections ?? false),
  );

  /**
   * Whether the bulk actions bar offers Edit access. Left out entirely when the member can edit
   * none of the listed folders: a permanently disabled button is worth less than the checkbox
   * column it would cost.
   */
  protected readonly showBulkEditAccess = computed(
    () => this.bulkEditAccessDialog != null && this.sharedFolders().some((row) => row.canEdit),
  );

  /** Whether the bulk actions bar offers Delete — see {@link showBulkEditAccess}. */
  protected readonly showBulkDelete = computed(
    () => this.bulkDeleteDialog != null && this.sharedFolders().some((row) => row.canDelete),
  );

  // Both dialogs re-check the batch and refuse it whole; disabling says so before the click.
  protected readonly bulkEditAccessDisabled = computed(() =>
    this.selectedRows().some((row) => !row.canEdit),
  );

  protected readonly bulkDeleteDisabled = computed(() =>
    this.selectedRows().some((row) => !row.canDelete),
  );

  /**
   * A field rather than an inline template literal: the table rebuilds its selection model whenever
   * this config's identity changes, so a fresh object per change detection pass would drop the
   * selection as fast as it was made.
   */
  private readonly multiSelect: SelectionConfig<SharedFolderRow> = { multiple: true };

  /**
   * Row selection, on only while there's a bulk action to act on it — the rows take checkboxes
   * only once there's something to run against them.
   */
  protected readonly selection = computed<SelectionConfig<SharedFolderRow> | undefined>(() =>
    this.showBulkEditAccess() || this.showBulkDelete() ? this.multiSelect : undefined,
  );

  /**
   * The Items column's track. The flexible track normally belongs to Options; with no Options
   * column Items takes it, so the columns still span the table.
   */
  protected readonly itemsWidth = this.showOptions ? "minmax(100px, 160px)" : "minmax(100px, 1fr)";

  /**
   * The permissions the chip offers: those the rows carry, in {@link SHARED_FOLDER_PERMISSIONS}
   * order, so the menu never lists an option that matches nothing. Read off the *unfiltered*
   * `sharedFolders` so the options hold steady while a filter is active — the table's faceted
   * counts already say which would match.
   */
  protected readonly permissionOptions = computed(() => {
    const present = new Set(this.sharedFolders().map((row) => row.permissions));
    return SHARED_FOLDER_PERMISSIONS.filter((permission) => present.has(permission));
  });

  /** Whether the chip has anything to narrow. One distinct permission can't exclude a row. */
  protected readonly showPermissions = computed(() => this.permissionOptions().length > 1);

  protected readonly permissionMessageKey = sharedFolderPermissionMessageKey;

  protected readonly vaultScopeCommands = vaultScopeCommands;

  protected readonly VaultScopeType = VaultScopeType;

  /** Separates "filtered down to nothing" from "no shared folders yet" for the empty state. */
  private readonly hasRows = computed(() => this.sharedFolders().length > 0);

  /**
   * Empty-state copy. One `slot="empty"` covers both cases, so each branch resolves to an i18n key
   * rather than wrapping the slots in an `@if` — content projection only matches static top-level
   * nodes, so anything inside a conditional block never reaches its slot. The graphic branches
   * through a binding for the same reason.
   */
  protected readonly emptyTitleKey = computed(() =>
    this.hasRows() ? "noMatchingItems" : "noSharedFoldersAdded",
  );

  protected readonly emptyDescriptionKey = computed(() =>
    this.hasRows() ? "clearFiltersOrTryAnother" : "noSharedFoldersAddedDescription",
  );

  protected readonly emptyIcon = computed(() => (this.hasRows() ? NoResults : NoFolders));

  /**
   * Orders the permissions column by {@link SHARED_FOLDER_PERMISSIONS}. The default accessor would
   * sort on the raw permission — an internal, untranslated string — which reads as arbitrary.
   */
  protected readonly sortByPermission: SortFn = (a: SharedFolderRow, b: SharedFolderRow) =>
    sharedFolderPermissionOrder(a.permissions) - sharedFolderPermissionOrder(b.permissions);

  protected readonly filter = (row: SharedFolderRow, values: SharedFoldersTableFilters): boolean =>
    this.matchesSearch(row, values.search) && this.matchesPermissions(row, values.permissions);

  constructor() {
    // Carry the selection onto each new set of rows — see `reconcileSelection`. The rows and the
    // model are the only dependencies; the selection it reads and writes stays untracked, so the
    // reconciliation doesn't re-run itself.
    effect(() => {
      const rows = this.sharedFolders();
      const model = this.tableComponent()?.selectionModel();
      if (model == null) {
        return;
      }
      untracked(() => this.reconcileSelection(model, rows));
    });

    // The bar is `position: fixed`, but inline it would sit inside the layout's <main>, whose
    // `contain: strict` makes it the containing block — so the hidden bar, translated below the
    // fold, would add scroll height to the page. The layout's footer region, a sibling of <main>,
    // escapes that. Matches `bit-vault-batch-action`.
    afterNextRender(() => {
      const portal = new TemplatePortal(this.bulkBarTemplate(), this.viewContainerRef);
      this.layoutFooter.attach(portal);
      this.destroyRef.onDestroy(() => this.layoutFooter.detach(portal));
    });
  }

  /** Clears the table's selection, for the bulk actions bar's dismiss. */
  protected clearSelection(): void {
    this.tableComponent()?.selectionModel()?.clear();
  }

  protected async addSharedFolder(): Promise<void> {
    const organizationId = this.organizationId();
    if (organizationId == null) {
      return;
    }

    await this.collectionDialog?.open({ organizationId });
  }

  protected async editSharedFolder(row: SharedFolderRow): Promise<void> {
    await this.openSharedFolder(row, CollectionDialogTab.Info);
  }

  protected async editSharedFolderAccess(row: SharedFolderRow): Promise<void> {
    await this.openSharedFolder(row, CollectionDialogTab.Access);
  }

  private async openSharedFolder(
    row: SharedFolderRow,
    initialTab: CollectionDialogTab,
  ): Promise<void> {
    await this.collectionDialog?.open({
      organizationId: row.organizationId,
      collectionId: row.id,
      initialTab,
    });
  }

  /**
   * Deletes one folder through the shared bulk delete dialog, which owns the whole sequence —
   * confirmation, requests, resync, and toast. It clears the deleted folder from
   * `CollectionService`, so the table's stream re-emits without it.
   */
  protected async deleteSharedFolder(row: SharedFolderRow): Promise<void> {
    await this.deleteSharedFolders([row.collection]);
  }

  /**
   * Opens the shared access editor over every selected folder — the same dialog the organization
   * vault's Edit access reaches. It writes through `CollectionAdminService` and shows its own
   * toast, so nothing is written back here.
   */
  protected readonly editSelectedAccess = async (): Promise<void> => {
    const organizationId = this.organizationId();
    const collections = this.selectedRows().map((row) => row.collection);
    if (organizationId == null || collections.length === 0) {
      return;
    }

    await this.bulkEditAccessDialog?.open({ organizationId, collections });
  };

  protected readonly deleteSelected = async (): Promise<void> => {
    await this.deleteSharedFolders(this.selectedRows().map((row) => row.collection));
  };

  private async deleteSharedFolders(collections: CollectionView[]): Promise<void> {
    const organization = this.organization();
    if (organization == null || collections.length === 0) {
      return;
    }

    // `organization` rather than `organizations`: the route scopes this page to a single org.
    await this.bulkDeleteDialog?.open({ organization, collections });
  }

  /**
   * Re-points the selection at the current rows, by folder id.
   *
   * The selection holds row *objects*, and `bit-table-v2` rebuilds its model only when the selection
   * config's identity changes — never when the data does. But the rows come from a stream, so any
   * sync re-emits fresh objects for the same folders.
   *
   * Matched on id rather than cleared outright, so a background sync doesn't cost an in-progress
   * selection. A folder that's gone from the rows drops out of it.
   */
  private reconcileSelection(
    model: TableSelectionModel<SharedFolderRow>,
    rows: readonly SharedFolderRow[],
  ): void {
    const selected = model.selected();
    if (selected.length === 0) {
      return;
    }

    const current = rows.filter((row) => selected.some((selection) => selection.id === row.id));

    // Already pointing at these exact objects: re-selecting would emit a no-op `selectedChange`.
    if (current.length === selected.length && current.every((row) => selected.includes(row))) {
      return;
    }

    model.clear();
    model.select(...current);
  }

  private matchesSearch(row: SharedFolderRow, search: string | undefined): boolean {
    const term = search?.trim().toLowerCase();
    return !term || row.name.toLowerCase().includes(term);
  }

  /**
   * The chip is multi-select, so a row matches if it carries *any* of the chosen permissions.
   * `undefined` and `[]` both mean unfiltered.
   */
  private matchesPermissions(
    row: SharedFolderRow,
    permissions: SharedFolderPermission[] | undefined,
  ): boolean {
    return !permissions?.length || permissions.includes(row.permissions);
  }

  protected hasActiveChipFilters(
    table: BitTableV2Component<
      SharedFolderRow,
      SharedFoldersTableColumn,
      SharedFoldersTableFilters
    >,
  ): boolean {
    return table
      .filterControls()
      .some((control: FilterControl) => control.key() !== SEARCH_FILTER_KEY && control.active());
  }

  protected clearChipFilters(
    table: BitTableV2Component<
      SharedFolderRow,
      SharedFoldersTableColumn,
      SharedFoldersTableFilters
    >,
  ): void {
    for (const control of table.filterControls()) {
      if (control.key() !== SEARCH_FILTER_KEY) {
        control.setValue(undefined);
      }
    }
  }
}
