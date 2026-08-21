import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
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
  IconButtonModule,
  IconModule,
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
};

/**
 * A shared folders table: name, permissions, item count, and a per-row Options menu, with a search
 * field and an Add button in the toolbar above them.
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
    I18nPipe,
    IconButtonModule,
    IconModule,
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
   * Matches a row against the toolbar's search term, on name only — the permission label and the
   * item count are facets of the folder rather than ways a person names one.
   */
  protected readonly filter = (row: R, values: SharedFoldersTableFilters): boolean => {
    const search = values.search?.trim().toLowerCase();
    return !search || row.name.toLowerCase().includes(search);
  };

  /** The actions visible for `row`, honouring each action's optional `show` predicate. */
  protected visibleActions(row: R): SharedFoldersTableRowAction<R>[] {
    return this.rowActions().filter((action) => action.show?.(row) ?? true);
  }

  protected handleAction(action: SharedFoldersTableRowAction<R>, row: R): void {
    void action.run(row);
  }
}
