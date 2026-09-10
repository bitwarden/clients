import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  signal,
  TrackByFunction,
  untracked,
  viewChild,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { RouterLink } from "@angular/router";
import { auditTime, combineLatest, fromEvent, map, switchMap } from "rxjs";

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
  BitTablePaginatorComponent,
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
  LinkModule,
  MenuModule,
  SearchModule,
  SelectionConfig,
  SkeletonTextComponent,
  SortFn,
  StatusLockupComponent,
  SvgComponent,
  TableSelectionModel,
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

/**
 * `bit-row`'s minimum height in table presentation, in px. A fallback: it sizes the first page and
 * stands in where there's no layout to measure, but a rendered row's measured height wins.
 */
const ROW_HEIGHT_PX = 56;

/** The chrome below the rows, in px: the paginator's height plus a gutter. */
const FOOTER_HEIGHT_PX = 84;

/** The fewest rows a page holds. Below this the paginator isn't worth showing. */
const MIN_PAGE_SIZE = 5;

/** Rows per page until the first row has been measured. */
const DEFAULT_PAGE_SIZE = 10;

/**
 * Page sizes offered alongside the fitted one — `bit-table-paginator`'s defaults, so a longer page
 * than the window fits can still be asked for.
 */
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

/** How long a burst of `resize` events is collapsed before re-fitting the page. */
const RESIZE_AUDIT_MS = 100;

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
 * The shared folders of one organization vault: name, permissions, item count, and a per-row
 * Options menu, with a search field, a Permissions filter chip, an Add button, and a bulk actions
 * bar. Self-contained — it reads the route, loads the folders, and owns its dialogs. Project the
 * client's page header into the default slot:
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
 *
 * The rows page themselves against the window, so the paginator shows only when the folders don't
 * all fit — see {@link autoPageSize}.
 */
@Component({
  selector: "vault-shared-folders",
  templateUrl: "./shared-folders.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "tw-flex tw-flex-col tw-h-full tw-min-h-0",
  },
  imports: [
    BitCellComponent,
    BitCellDefDirective,
    BitCellLoadingDirective,
    BitColumnComponent,
    BitHeaderCellComponent,
    BitTablePaginatorComponent,
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
  ],
})
export class SharedFoldersComponent {
  private readonly accountService = inject(AccountService);
  private readonly cipherService = inject(CipherService);
  private readonly collectionService = inject(CollectionService);
  private readonly organizationService = inject(OrganizationService);

  /** Measured to fit the page to the window — see {@link autoPageSize}. */
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

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

  /**
   * The selected rows, read off the table's own model so a bulk action can be handed the rows it
   * acts on. Read rather than mirrored through `selectedChange`, so it empties with the model when
   * selection turns off — see {@link selection}. The bar reads its own count off the table.
   */
  protected readonly selectedRows = computed<readonly SharedFolderRow[]>(
    () => this.tableComponent()?.selectionModel()?.selected() ?? [],
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

  /**
   * The window's height, in px, so the fitted page follows a resize. Audited because `resize` fires
   * in bursts while a window is dragged.
   */
  private readonly viewportHeight = toSignal(
    fromEvent(window, "resize").pipe(
      auditTime(RESIZE_AUDIT_MS),
      map(() => window.innerHeight),
    ),
    { initialValue: window.innerHeight },
  );

  /**
   * The first rendered row's distance from the top of the viewport, in px, which accounts for the
   * page header, toolbar, and table header at once rather than assuming any of their heights.
   * `undefined` until a row has rendered.
   */
  private readonly rowsTop = signal<number | undefined>(undefined);

  /** A rendered row's measured height, in px, falling back to {@link ROW_HEIGHT_PX}. */
  private readonly rowHeight = signal(ROW_HEIGHT_PX);

  /**
   * Rows per page: as many as fit between the top of the rows and the bottom of the window. This is
   * what makes the paginator conditional — the template hides a single-page paginator, so
   * pagination appears exactly when the window can't show every folder at once.
   */
  protected readonly autoPageSize = computed(() => {
    const top = this.rowsTop();
    if (top === undefined) {
      return DEFAULT_PAGE_SIZE;
    }
    // Clamped at 0: scrolled far enough down, the rows start above the viewport, and the room they
    // have is the whole window rather than more of it.
    const available = this.viewportHeight() - Math.max(0, top) - FOOTER_HEIGHT_PX;
    return Math.max(MIN_PAGE_SIZE, Math.floor(available / this.rowHeight()));
  });

  /**
   * The sizes the paginator's select offers: the fitted size and {@link PAGE_SIZE_OPTIONS}, in
   * order. The fitted size is included so the select isn't blank on a value it has no option for.
   * A size chosen by hand holds until the next resize, which re-fits.
   */
  protected readonly pageSizeOptions = computed(() =>
    [...new Set([this.autoPageSize(), ...PAGE_SIZE_OPTIONS])].sort((a, b) => a - b),
  );

  constructor() {
    // Re-fit at first paint, as the folders arrive and change, and on resize. A render effect so
    // the measurement sees laid-out rows; it depends on nothing it writes, so the re-render it
    // triggers doesn't run it again.
    afterRenderEffect(() => {
      this.sharedFolders();
      this.loading();
      this.viewportHeight();
      this.measureRows();
    });

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

  /**
   * Measures the first rendered row: its top edge sets how much of the window is left for rows, its
   * height sets how many fit. Both come off the one row, so a table whose first row wraps is fitted
   * a little short rather than a little long.
   */
  private measureRows(): void {
    const row = this.host.nativeElement.querySelector("bit-row");
    if (row == null) {
      return;
    }
    const { top, height } = row.getBoundingClientRect();
    this.rowsTop.set(top);
    // An unlaid-out row measures 0 (a `TestBed` has no layout engine), and every row would fit in a
    // page of zero-height rows.
    if (height > 0) {
      this.rowHeight.set(height);
    }
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
