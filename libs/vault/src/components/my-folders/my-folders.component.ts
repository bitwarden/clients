import { TemplatePortal } from "@angular/cdk/portal";
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  TemplateRef,
  TrackByFunction,
  ViewContainerRef,
  afterNextRender,
  computed,
  effect,
  inject,
  untracked,
  viewChild,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { RouterLink } from "@angular/router";
import { combineLatest, lastValueFrom, map, switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
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
  DialogService,
  IconButtonModule,
  IconTileComponent,
  LayoutFooterService,
  LinkModule,
  SearchModule,
  SelectionConfig,
  SkeletonTextComponent,
  TooltipDirective,
  defineTable,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { buildFolderRows, FolderTableRow } from "../../models/folder-table-row";
import { folderCommands } from "../../models/vault-scope";
import { MyFolderActionsService } from "../../services/my-folder-actions.service";
import { AddEditFolderDialogComponent } from "../add-edit-folder-dialog/add-edit-folder-dialog.component";
import { openDeleteFolderDialog } from "../delete-folder-dialog/delete-folder-dialog.component";
import {
  BULK_BAR_CLEARANCE,
  VAULT_TABLE_MIN_HEIGHT,
  VAULT_TABLE_ROW_HEIGHT,
} from "../vault-table-sizing";

import { EmptyFoldersComponent } from "./empty-folders.component";

/**
 * Self-contained My folders page. Project the client's header into the default slot:
 *
 * ```html
 * <vault-my-folders><app-header></app-header></vault-my-folders>
 * ```
 */
@Component({
  selector: "vault-my-folders",
  templateUrl: "./my-folders.component.html",
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
    EmptyFoldersComponent,
    I18nPipe,
    IconButtonModule,
    IconTileComponent,
    LinkModule,
    RouterLink,
    SearchModule,
    SkeletonTextComponent,
    TooltipDirective,
  ],
})
export class MyFoldersComponent {
  private readonly accountService = inject(AccountService);
  private readonly cipherService = inject(CipherService);
  private readonly dialogService = inject(DialogService);
  private readonly folderActions = inject(MyFolderActionsService);
  private readonly folderService = inject(FolderService);
  private readonly layoutFooter = inject(LayoutFooterService);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly destroyRef = inject(DestroyRef);

  private readonly bulkBarTemplate = viewChild.required<TemplateRef<unknown>>("bulkBar");

  private readonly tableRef = viewChild(BitTableV2Component<FolderTableRow>);

  private readonly loadedRows = toSignal(
    this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) =>
        combineLatest([
          this.folderService.folderViews$(userId),
          this.cipherService.cipherListViewsIncludingRestricted$(userId).pipe(filterOutNullish()),
        ]),
      ),
      map(([folders, ciphers]) => buildFolderRows(folders, ciphers)),
    ),
  );

  private readonly rows = computed(() => this.loadedRows() ?? []);

  protected readonly loading = computed(() => this.loadedRows() === undefined);

  protected readonly hasItems = computed(() => this.rows().length > 0);

  protected readonly folderCommands = folderCommands;

  protected readonly search = computed(
    () => (this.tableRef()?.filterValues() as { search?: string } | undefined)?.search,
  );

  protected readonly table = defineTable<FolderTableRow, "options">(this.rows);

  protected readonly selection: SelectionConfig<FolderTableRow> = { multiple: true };

  protected readonly trackById: TrackByFunction<FolderTableRow> = (_, row) => row.id;

  protected readonly rowHeight = VAULT_TABLE_ROW_HEIGHT;
  protected readonly minTableHeight = VAULT_TABLE_MIN_HEIGHT;

  protected readonly selected = computed(() => this.tableRef()?.selectionModel()?.selected() ?? []);

  protected readonly bulkBarClearance = computed(() =>
    this.selected().length > 0 ? BULK_BAR_CLEARANCE : 0,
  );

  constructor() {
    // Keep the table selection in sync with the rows. If the rows change (e.g., a folder is deleted), we need to update the selection to remove any rows that no longer exist.
    effect(() => {
      const rows = this.rows();
      const model = this.tableRef()?.selectionModel();
      if (model == null) {
        return;
      }
      untracked(() => {
        const selected = model.selected();
        const current = rows.filter((row) => selected.some((sel) => sel.id === row.id));

        if (current.length === selected.length && current.every((row) => selected.includes(row))) {
          return;
        }

        model.clear();
        model.select(...current);
      });
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

  protected clearSelection(): void {
    this.tableRef()?.selectionModel()?.clear();
  }

  protected readonly filter = (row: FolderTableRow, values: { search?: string }) =>
    !values.search || row.name.toLowerCase().includes(values.search.toLowerCase());

  protected clearSearch(): void {
    this.tableRef()
      ?.filterControls()
      .find((c) => c.key() === "search")
      ?.setValue("");
  }

  protected async addFolder(): Promise<void> {
    await lastValueFrom(AddEditFolderDialogComponent.open(this.dialogService).closed);
  }

  protected async editFolder(row: FolderTableRow): Promise<void> {
    await this.folderActions.edit(row.id);
  }

  protected async deleteFolder(row: FolderTableRow): Promise<void> {
    await this.folderActions.delete(row);
  }

  protected readonly deleteSelected = async (): Promise<void> => {
    const selected = this.selected();

    if (selected.length === 0) {
      return;
    }

    if (selected.length === 1) {
      await this.deleteFolder(selected[0]);
      return;
    }

    const confirmed = await lastValueFrom(
      openDeleteFolderDialog(this.dialogService, { count: selected.length }).closed,
    );

    if (!confirmed) {
      return;
    }

    await this.folderActions.deleteFolders(
      selected.map((row) => row.id),
      "foldersDeleted",
    );
  };
}
