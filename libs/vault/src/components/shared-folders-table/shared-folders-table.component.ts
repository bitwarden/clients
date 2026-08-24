import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  TrackByFunction,
} from "@angular/core";

import {
  BitCellComponent,
  BitCellDefDirective,
  BitCellLoadingDirective,
  BitColumnComponent,
  BitHeaderCellComponent,
  BitTableToolbarComponent,
  BitTableV2Component,
  ButtonModule,
  defineTable,
  FilterMenuModule,
  IconButtonModule,
  IconModule,
  IconTileComponent,
  MenuModule,
  SearchModule,
  SkeletonTextComponent,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

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

/** The shape of {@link BitTableV2Component.filterValues} for this table. */
export type SharedFoldersTableFilters = {
  /**
   * Reserved key — the table adopts the projected `bit-search` under it automatically, so it
   * carries the term for seeding, URL sync, and Clear all as well as for matching.
   */
  search?: string;

  /**
   * Permission labels. Multi-select: a row matches any selected label — see {@link
   * SharedFoldersTableComponent.permissionOptions} for where the labels come from.
   */
  permissions?: string[];
};

/**
 * A shared folders table: name, permissions, item count, and a per-row Options menu, with a search
 * field, a Permissions filter chip, and an Add button in the toolbar above them.
 *
 * The table is presentational — it sorts and searches the rows it is handed and reports intent
 * back through {@link add} and each action's `run`. Loading the folders, resolving what a
 * permission is called, and acting on a row all stay with the client.
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
    ButtonModule,
    FilterMenuModule,
    I18nPipe,
    IconButtonModule,
    IconModule,
    IconTileComponent,
    MenuModule,
    SearchModule,
    SkeletonTextComponent,
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
   * Syncs the search term and sort to the URL under this prefix — see
   * {@link BitTableV2Component.queryParam}. Omit to leave the URL untouched.
   */
  readonly queryParam = input<string>();

  /** Emitted when the toolbar's Add button is pressed. */
  readonly add = output<void>();

  protected readonly table = defineTable<R, SharedFoldersTableColumn>(this.sharedFolders);

  protected readonly trackById: TrackByFunction<R> = (_index, row) => row.id;

  /**
   * The permission labels the Permissions chip offers, deduplicated and sorted for a stable menu.
   *
   * Derived from the rows rather than taken as an input: a permission label is an opaque,
   * already-translated string to the table (see {@link SharedFolderRow.permissions}), so the rows
   * on hand are the only account of which permissions exist. Read off the *unfiltered*
   * `sharedFolders` so the options hold steady while a filter is active — the table's faceted
   * counts already say which of them would match.
   */
  protected readonly permissionOptions = computed(() =>
    [...new Set(this.sharedFolders().map((row) => row.permissions))].sort((a, b) =>
      a.localeCompare(b),
    ),
  );

  /**
   * Whether the Permissions chip has anything to narrow. One distinct label can't exclude a row,
   * so the chip is omitted rather than offered as a no-op.
   */
  protected readonly showPermissions = computed(() => this.permissionOptions().length > 1);

  /** The single predicate the table derives its rows, counts, and empty state from. */
  protected readonly filter = (row: R, values: SharedFoldersTableFilters): boolean =>
    this.matchesSearch(row, values.search) && this.matchesPermissions(row, values.permissions);

  /**
   * Matches a row against the toolbar's search term, on name only — the permission label and the
   * item count are facets of the folder rather than ways a person names one.
   */
  private matchesSearch(row: R, search: string | undefined): boolean {
    const term = search?.trim().toLowerCase();
    return !term || row.name.toLowerCase().includes(term);
  }

  /**
   * The Permissions chip is multi-select: `permissions` is an array of the labels chosen from
   * {@link permissionOptions}, and a row matches if it carries *any* of them. `undefined` and `[]`
   * both mean unfiltered.
   */
  private matchesPermissions(row: R, permissions: string[] | undefined): boolean {
    return !permissions?.length || permissions.includes(row.permissions);
  }

  /** The actions visible for `row`, honouring each action's optional `show` predicate. */
  protected visibleActions(row: R): SharedFoldersTableRowAction<R>[] {
    return this.rowActions().filter((action) => action.show?.(row) ?? true);
  }

  protected handleAction(action: SharedFoldersTableRowAction<R>, row: R): void {
    void action.run(row);
  }
}
