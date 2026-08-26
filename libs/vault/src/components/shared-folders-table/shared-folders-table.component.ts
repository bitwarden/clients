import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
  TrackByFunction,
} from "@angular/core";

import { NoFolders, NoResults } from "@bitwarden/assets/svg";
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
  MenuModule,
  SearchModule,
  SelectionConfig,
  SkeletonTextComponent,
  SortFn,
  StatusLockupComponent,
  SvgComponent,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import {
  SHARED_FOLDER_PERMISSIONS,
  SharedFolderPermission,
  sharedFolderPermissionMessageKey,
  sharedFolderPermissionOrder,
} from "./shared-folder-permission";
import { SharedFoldersTableBulkAction } from "./shared-folders-table-bulk-action";
import { SharedFolderRow, SharedFoldersTableRowAction } from "./shared-folders-table-row";

/**
 * Every column the table declares, in display order.
 *
 * Declared as synthetic columns (`defineTable`'s second type parameter) rather than sourced from
 * the row type, so `table.columns.*` stays resolvable while the row type is an unbound generic.
 */
export const SHARED_FOLDERS_COLUMNS = Object.freeze([
  "name",
  "permissions",
  "items",
  "options",
] as const);

/** Passed as `defineTable`'s second type parameter. */
export type SharedFoldersTableColumn = (typeof SHARED_FOLDERS_COLUMNS)[number];

/**
 * The `filterValues` key `bit-table-v2` reserves for a projected `bit-search` (its module-private
 * `SEARCH_FILTER_KEY`). Mirrored here so the empty state's Clear all can skip it and clear chip
 * filters only, matching the toolbar's own `clearAll()`.
 */
const SEARCH_FILTER_KEY = "search";

/** The shape of {@link BitTableV2Component.filterValues} for this table. */
export type SharedFoldersTableFilters = {
  /**
   * Reserved key — the table adopts the projected `bit-search` under it automatically, so it
   * carries the term for seeding, URL sync, and Clear all as well as for matching.
   */
  search?: string;

  /**
   * Permissions. Multi-select: a row matches any selected permission — see {@link
   * SharedFoldersTableComponent.permissionOptions} for where the options come from. Holds the
   * permission rather than its label so a URL-synced filter survives a change of locale.
   */
  permissions?: SharedFolderPermission[];
};

/**
 * A shared folders table: name, permissions, item count, and a per-row Options menu, with a search
 * field, a Permissions filter chip, and an Add button in the toolbar above them. Supply {@link
 * SharedFoldersTableComponent.bulkActions} and the rows also take checkboxes, backed by a bulk
 * actions bar.
 *
 * The table is presentational — it sorts and searches the rows it is handed and reports intent
 * back through {@link add} and each action's `run`. Loading the folders, resolving each folder's
 * permission, and acting on a row all stay with the client.
 *
 * Requires `DialogService` in the injector — `bit-table-toolbar` injects it for its small-screen
 * filter dialog. Every client provides it through `DialogModule`; a Storybook story or a bare
 * `TestBed` has to supply it itself.
 *
 * @example
 * ```html
 * <vault-shared-folders-table
 *   [sharedFolders]="sharedFolders()"
 *   [loading]="loading()"
 *   [rowActions]="rowActions()"
 *   [bulkActions]="bulkActions()"
 *   (add)="addSharedFolder()"
 * />
 * ```
 */
@Component({
  selector: "vault-shared-folders-table",
  templateUrl: "./shared-folders-table.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
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
    MenuModule,
    SearchModule,
    SkeletonTextComponent,
    StatusLockupComponent,
    SvgComponent,
  ],
})
export class SharedFoldersTableComponent<R extends SharedFolderRow = SharedFolderRow> {
  /** The rows to display. */
  readonly sharedFolders = input<R[]>([]);

  /** Shows skeleton rows in place of the data while the client resolves it. */
  readonly loading = input(false, { transform: booleanAttribute });

  /** The actions offered in each row's Options menu, in display order. */
  readonly rowActions = input<SharedFoldersTableRowAction<R>[]>([]);

  /**
   * The actions the bulk actions bar offers while rows are selected, in display order.
   *
   * Supplying at least one is also what turns selection on: the rows take checkboxes only once the
   * selection has something to act on. The bar packs whatever doesn't fit into its own overflow
   * menu, so the list needn't be short.
   */
  readonly bulkActions = input<SharedFoldersTableBulkAction<R>[]>([]);

  /**
   * Syncs the search term and sort to the URL under this prefix — see
   * {@link BitTableV2Component.queryParam}. Omit to leave the URL untouched.
   */
  readonly queryParam = input<string>();

  /** Emitted when the toolbar's Add button is pressed. */
  readonly add = output<void>();

  protected readonly table = defineTable<R, SharedFoldersTableColumn>(this.sharedFolders);

  protected readonly trackById: TrackByFunction<R> = (_index, row) => row.id;

  /**
   * The rows the table has selected, mirrored from its `selectedChange` output so a bulk action can
   * be handed the rows it acts on. The bar reads its own count off the table directly.
   */
  protected readonly selectedRows = signal<readonly R[]>([]);

  /**
   * Held as a field rather than written inline in the template: the table rebuilds its selection
   * model whenever this config's identity changes, so a fresh object each change detection pass
   * would drop the selection as fast as it was made.
   */
  private readonly multiSelect: SelectionConfig<R> = { multiple: true };

  /**
   * Row selection, on only while there are bulk actions to act on it — checkboxes that lead
   * nowhere are noise, and the bar they belong to would come up empty.
   */
  protected readonly selection = computed<SelectionConfig<R> | undefined>(() =>
    this.bulkActions().length > 0 ? this.multiSelect : undefined,
  );

  /**
   * The bulk actions bound to the current selection. `bit-bulk-action` takes a bare `() => void`
   * and an already-resolved `disabled`, so each action's callbacks are applied to the selected rows
   * here — once per selection change, rather than on every change detection pass.
   */
  protected readonly resolvedBulkActions = computed(() => {
    const rows = this.selectedRows();
    return this.bulkActions().map((action) => ({
      id: action.id,
      label: action.label,
      icon: action.icon,
      disabled: action.disabled?.(rows) ?? false,
      invoke: (): void => void action.run(rows),
    }));
  });

  /**
   * The permissions the Permissions chip offers: those the rows actually carry, in {@link
   * SHARED_FOLDER_PERMISSIONS} order.
   *
   * Only the permissions present are offered, so the menu never lists an option that matches
   * nothing — but they're read off the *unfiltered* `sharedFolders` so the options hold steady
   * while a filter is active; the table's faceted counts already say which of them would match.
   */
  protected readonly permissionOptions = computed(() => {
    const present = new Set(this.sharedFolders().map((row) => row.permissions));
    return SHARED_FOLDER_PERMISSIONS.filter((permission) => present.has(permission));
  });

  /**
   * Whether the Permissions chip has anything to narrow. One distinct permission can't exclude a
   * row, so the chip is omitted rather than offered as a no-op.
   */
  protected readonly showPermissions = computed(() => this.permissionOptions().length > 1);

  /** The i18n key naming `permission`, for the cells and the Permissions chip's options. */
  protected readonly permissionMessageKey = sharedFolderPermissionMessageKey;

  /**
   * Whether the table has rows at all, separating "filtered down to nothing" from "no shared
   * folders yet" — the two cases the one empty state has to cover.
   */
  private readonly hasRows = computed(() => this.sharedFolders().length > 0);

  /**
   * Empty-state copy. A single `slot="empty"` has to cover both cases, so each branch resolves to
   * an i18n key rather than wrapping the slots in an `@if`: content projection only matches the
   * static top-level nodes of projected content, so anything inside a conditional block never
   * reaches its slot. The graphic branches through a binding for the same reason.
   */
  protected readonly emptyTitleKey = computed(() =>
    this.hasRows() ? "noMatchingItems" : "noSharedFoldersAdded",
  );

  protected readonly emptyDescriptionKey = computed(() =>
    this.hasRows() ? "clearFiltersOrTryAnother" : "noSharedFoldersAddedDescription",
  );

  protected readonly emptyIcon = computed(() => (this.hasRows() ? NoResults : NoFolders));

  /**
   * Orders the permissions column by {@link SHARED_FOLDER_PERMISSIONS} rather than by label. The
   * default accessor would sort on the raw permission — an internal, untranslated string — putting
   * the rows in an order that reads as arbitrary in every locale.
   */
  protected readonly sortByPermission: SortFn = (a: R, b: R) =>
    sharedFolderPermissionOrder(a.permissions) - sharedFolderPermissionOrder(b.permissions);

  /** The single predicate the table derives its rows, counts, and empty state from. */
  protected readonly filter = (row: R, values: SharedFoldersTableFilters): boolean =>
    this.matchesSearch(row, values.search) && this.matchesPermissions(row, values.permissions);

  /**
   * Matches a row against the toolbar's search term, on name only — the permission and the item
   * count are facets of the folder rather than ways a person names one.
   */
  private matchesSearch(row: R, search: string | undefined): boolean {
    const term = search?.trim().toLowerCase();
    return !term || row.name.toLowerCase().includes(term);
  }

  /**
   * The Permissions chip is multi-select: `permissions` is an array of the permissions chosen from
   * {@link permissionOptions}, and a row matches if it carries *any* of them. `undefined` and `[]`
   * both mean unfiltered.
   */
  private matchesPermissions(row: R, permissions: SharedFolderPermission[] | undefined): boolean {
    return !permissions?.length || permissions.includes(row.permissions);
  }

  /**
   * Whether at least one chip filter is active, excluding the reserved {@link SEARCH_FILTER_KEY}.
   */
  protected hasActiveChipFilters(
    table: BitTableV2Component<R, SharedFoldersTableColumn, SharedFoldersTableFilters>,
  ): boolean {
    return table
      .filterControls()
      .some((control: FilterControl) => control.key() !== SEARCH_FILTER_KEY && control.active());
  }

  /** Clears every chip filter, leaving the search term untouched. */
  protected clearChipFilters(
    table: BitTableV2Component<R, SharedFoldersTableColumn, SharedFoldersTableFilters>,
  ): void {
    for (const control of table.filterControls()) {
      if (control.key() !== SEARCH_FILTER_KEY) {
        control.setValue(undefined);
      }
    }
  }

  /** The actions visible for `row`, honouring each action's optional `show` predicate. */
  protected visibleActions(row: R): SharedFoldersTableRowAction<R>[] {
    return this.rowActions().filter((action) => action.show?.(row) ?? true);
  }

  protected handleAction(action: SharedFoldersTableRowAction<R>, row: R): void {
    void action.run(row);
  }
}
