import {
  afterRenderEffect,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  TrackByFunction,
  untracked,
  viewChild,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { RouterLink } from "@angular/router";
import { auditTime, fromEvent, map } from "rxjs";

import { NoFolders, NoResults } from "@bitwarden/assets/svg";
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

import {
  SHARED_FOLDER_PERMISSIONS,
  SharedFolderPermission,
  sharedFolderPermissionMessageKey,
  sharedFolderPermissionOrder,
} from "./shared-folder-permission";
import { SharedFoldersTableBulkAction } from "./shared-folders-table-bulk-action";
import { SharedFolderRow, SharedFoldersTableRowAction } from "./shared-folders-table-row";

/**
 * Every column the table declares, in display order. Synthetic (`defineTable`'s second type
 * parameter) rather than sourced from the row type, so `table.columns.*` stays resolvable while
 * the row type is an unbound generic.
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

/**
 * `bit-row`'s minimum height in table presentation, in px. A fallback: it sizes the first page and
 * stands in where there's no layout to measure, but a rendered row's measured height wins.
 */
const ROW_HEIGHT_PX = 56;

/** The chrome below the rows, in px: the paginator's height plus a gutter. */
const FOOTER_HEIGHT_PX = 84;

/** The fewest rows a page holds. Below this a page costs more in paginator than it returns. */
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
 * A shared folders table: name, permissions, item count, and a per-row Options menu, with a search
 * field, a Permissions filter chip, and — with {@link SharedFoldersTableComponent.canAdd} — an Add
 * button. Supply {@link SharedFoldersTableComponent.bulkActions} and the rows also take checkboxes,
 * backed by a bulk actions bar.
 *
 * Presentational: it sorts and searches the rows it is handed and reports intent back through
 * {@link add} and each action's `run`. Loading the folders, resolving permissions, acting on a row,
 * and deciding who may add one all stay with the client.
 *
 * Each folder's name links to its organization's vault, drilled into that folder.
 *
 * The rows page themselves against the window, so the paginator shows only when the folders don't
 * all fit — see {@link autoPageSize}. Nothing to configure, but note the fit owns the page size, so
 * a `pageSize` in a URL-synced link gives way to whatever the reader's window fits.
 *
 * Requires `DialogService` (for `bit-table-toolbar`'s small-screen filter dialog) and a configured
 * `Router` (for the name column's `routerLink`) in the injector. Clients get both from their module
 * graph; a story or bare `TestBed` has to supply them.
 *
 * @example
 * ```html
 * <vault-shared-folders-table
 *   [sharedFolders]="sharedFolders()"
 *   [loading]="loading()"
 *   [rowActions]="rowActions()"
 *   [bulkActions]="bulkActions()"
 *   [canAdd]="canAdd()"
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
export class SharedFoldersTableComponent<R extends SharedFolderRow = SharedFolderRow> {
  /** Measured to fit the page to the window — see {@link autoPageSize}. */
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** The projected table, for the selection model it owns — see {@link reconcileSelection}. */
  private readonly tableComponent = viewChild(BitTableV2Component<R>);

  /** The rows to display. */
  readonly sharedFolders = input<R[]>([]);

  /** Shows skeleton rows in place of the data while the client resolves it. */
  readonly loading = input(false, { transform: booleanAttribute });

  /**
   * The actions offered in each row's Options menu, in display order. Supplying none drops the
   * Options column altogether — see {@link showOptions}.
   */
  readonly rowActions = input<SharedFoldersTableRowAction<R>[]>([]);

  /**
   * The actions the bulk actions bar offers while rows are selected, in display order. Supplying at
   * least one also turns selection on — the rows take checkboxes only once there's something to act
   * on. The bar packs whatever doesn't fit into its own overflow menu.
   */
  readonly bulkActions = input<SharedFoldersTableBulkAction<R>[]>([]);

  /**
   * Syncs the search term and sort to the URL under this prefix — see
   * {@link BitTableV2Component.queryParam}. Omit to leave the URL untouched.
   */
  readonly queryParam = input<string>();

  /**
   * Whether the toolbar offers its Add button. Off by default: creating a shared folder is
   * privileged, so a client opts in once it has checked. Prefixed because `add` already names the
   * output the button emits.
   */
  readonly canAdd = input(false, { transform: booleanAttribute });

  /** Emitted when the toolbar's Add button is pressed. */
  readonly add = output<void>();

  protected readonly table = defineTable<R, SharedFoldersTableColumn>(this.sharedFolders);

  protected readonly trackById: TrackByFunction<R> = (_index, row) => row.id;

  /**
   * The selected rows, mirrored from the table's `selectedChange` output so a bulk action can be
   * handed the rows it acts on. The bar reads its own count off the table directly.
   */
  protected readonly selectedRows = signal<readonly R[]>([]);

  /**
   * A field rather than an inline template literal: the table rebuilds its selection model whenever
   * this config's identity changes, so a fresh object per change detection pass would drop the
   * selection as fast as it was made.
   */
  private readonly multiSelect: SelectionConfig<R> = { multiple: true };

  /** Row selection, on only while there are bulk actions to act on it. */
  protected readonly selection = computed<SelectionConfig<R> | undefined>(() =>
    this.bulkActions().length > 0 ? this.multiSelect : undefined,
  );

  /**
   * The bulk actions bound to the current selection. `bit-bulk-action` takes a bare `() => void`
   * and an already-resolved `disabled`, so the callbacks are applied here — once per selection
   * change, rather than on every change detection pass.
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
   * Whether the Options column is offered at all — no row actions, no column. Gated on the actions
   * supplied rather than on what each row's `show` allows, so filtering can't make the column come
   * and go and resize every other column with it.
   */
  protected readonly showOptions = computed(() => this.rowActions().length > 0);

  /**
   * The Items column's track. The flexible track normally belongs to Options; with no Options
   * column Items takes it, so the columns still span the table.
   */
  protected readonly itemsWidth = computed(() =>
    this.showOptions() ? "minmax(100px, 160px)" : "minmax(100px, 1fr)",
  );

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

  /** The i18n key naming `permission`, for the cells and the Permissions chip's options. */
  protected readonly permissionMessageKey = sharedFolderPermissionMessageKey;

  /** Builds the route a folder's name links to, so the link and the route parser can't drift. */
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
  protected readonly sortByPermission: SortFn = (a: R, b: R) =>
    sharedFolderPermissionOrder(a.permissions) - sharedFolderPermissionOrder(b.permissions);

  /** The single predicate the table derives its rows, counts, and empty state from. */
  protected readonly filter = (row: R, values: SharedFoldersTableFilters): boolean =>
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

  /**
   * Re-points the selection at the current rows, by folder id.
   *
   * The selection holds row *objects*, and `bit-table-v2` rebuilds its model only when the selection
   * config's identity changes — never when the data does. But a client's rows come from a stream,
   * so any sync re-emits fresh objects for the same folders. Left alone, the selection would keep
   * holding the stale ones: checkboxes would render unchecked while the bar still announced a
   * count, and actions would run against rows that no longer reflect the vault.
   *
   * Matched on id rather than cleared outright, so a background sync doesn't cost an in-progress
   * selection. A folder that's gone from the rows drops out of it.
   */
  private reconcileSelection(model: TableSelectionModel<R>, rows: readonly R[]): void {
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

  /** Matches a row against the search term, on name only. */
  private matchesSearch(row: R, search: string | undefined): boolean {
    const term = search?.trim().toLowerCase();
    return !term || row.name.toLowerCase().includes(term);
  }

  /**
   * The chip is multi-select, so a row matches if it carries *any* of the chosen permissions.
   * `undefined` and `[]` both mean unfiltered.
   */
  private matchesPermissions(row: R, permissions: SharedFolderPermission[] | undefined): boolean {
    return !permissions?.length || permissions.includes(row.permissions);
  }

  /** Whether at least one chip filter is active, excluding the reserved search key. */
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
