import {
  ChangeDetectionStrategy,
  Component,
  TrackByFunction,
  computed,
  effect,
  inject,
  untracked,
  viewChild,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { combineLatest, firstValueFrom, lastValueFrom, map, switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderApiServiceAbstraction } from "@bitwarden/common/vault/abstractions/folder/folder-api.service.abstraction";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { filterOutNullish } from "@bitwarden/common/vault/utils/observable-utilities";
import {
  BitCellComponent,
  BitCellDefDirective,
  BitColumnComponent,
  BitHeaderCellComponent,
  BitTableToolbarComponent,
  BitTableV2Component,
  BulkActionComponent,
  BulkActionsBarComponent,
  ButtonModule,
  DialogService,
  IconButtonModule,
  SearchModule,
  SelectionConfig,
  ToastService,
  defineTable,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { AddEditFolderDialogComponent } from "@bitwarden/vault";

import { HeaderModule } from "../../layouts/header/header.module";

export type FolderTableRow = {
  id: string;
  name: string;
  /** An em-dash stands in for a folder with no name. */
  displayName: string;
  itemCount: number;
};

const EMPTY_NAME_PLACEHOLDER = "—";

/**
 * `folderViews$` includes a synthetic "No folder" entry with an empty id. Item counts exclude
 * trashed ciphers and include archived ones.
 */
export function buildFolderRows(folders: FolderView[], ciphers: CipherView[]): FolderTableRow[] {
  const countsByFolderId = new Map<string, number>();

  for (const cipher of ciphers) {
    if (cipher.isDeleted || cipher.folderId == null || cipher.folderId === "") {
      continue;
    }
    countsByFolderId.set(cipher.folderId, (countsByFolderId.get(cipher.folderId) ?? 0) + 1);
  }

  return folders
    .filter((folder) => folder.id != null && folder.id !== "")
    .map((folder) => ({
      id: folder.id,
      name: folder.name ?? "",
      displayName: folder.name?.trim() ? folder.name : EMPTY_NAME_PLACEHOLDER,
      itemCount: countsByFolderId.get(folder.id) ?? 0,
    }));
}

@Component({
  templateUrl: "./my-folders.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BitCellComponent,
    BitCellDefDirective,
    BitColumnComponent,
    BitHeaderCellComponent,
    BitTableToolbarComponent,
    BitTableV2Component,
    BulkActionComponent,
    BulkActionsBarComponent,
    ButtonModule,
    HeaderModule,
    I18nPipe,
    IconButtonModule,
    SearchModule,
  ],
})
export class MyFoldersComponent {
  private readonly accountService = inject(AccountService);
  private readonly cipherService = inject(CipherService);
  private readonly dialogService = inject(DialogService);
  private readonly folderApiService = inject(FolderApiServiceAbstraction);
  private readonly folderService = inject(FolderService);
  private readonly i18nService = inject(I18nService);
  private readonly logService = inject(LogService);
  private readonly toastService = inject(ToastService);

  private readonly tableRef = viewChild(BitTableV2Component<FolderTableRow>);

  private readonly loadedRows = toSignal(
    this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) =>
        combineLatest([
          this.folderService.folderViews$(userId),
          this.cipherService.cipherViews$(userId).pipe(filterOutNullish()),
        ]),
      ),
      map(([folders, ciphers]) => buildFolderRows(folders, ciphers)),
    ),
  );

  private readonly rows = computed(() => this.loadedRows() ?? []);

  protected readonly loading = computed(() => this.loadedRows() === undefined);

  protected readonly table = defineTable<FolderTableRow, "options">(this.rows);

  protected readonly selection: SelectionConfig<FolderTableRow> = { multiple: true };

  protected readonly trackById: TrackByFunction<FolderTableRow> = (_, row) => row.id;

  protected readonly selected = computed(() => this.tableRef()?.selectionModel()?.selected() ?? []);

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
  }

  protected readonly filter = (row: FolderTableRow, values: { search?: string }) =>
    !values.search || row.name.toLowerCase().includes(values.search.toLowerCase());

  protected readonly addFolder = async (): Promise<void> => {
    await lastValueFrom(AddEditFolderDialogComponent.open(this.dialogService).closed);
  };

  protected readonly editFolder = async (row: FolderTableRow): Promise<void> => {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const folder = await firstValueFrom(this.folderService.getDecrypted$(row.id, userId));

    if (folder == null) {
      return;
    }

    await lastValueFrom(
      AddEditFolderDialogComponent.open(this.dialogService, {
        editFolderConfig: { folder: { ...folder } },
        hideDelete: true,
      }).closed,
    );
  };

  protected readonly deleteFolder = async (row: FolderTableRow): Promise<void> => {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "deleteFolder" },
      content: { key: "deleteFolderDescription", placeholders: [row.displayName] },
      acceptButtonText: { key: "delete" },
      cancelButtonText: { key: "cancel" },
      type: "danger",
    });

    if (!confirmed) {
      return;
    }

    await this.deleteFolders([row.id], "deletedFolder");
  };

  protected readonly deleteSelected = async (): Promise<void> => {
    const selected = this.selected();

    if (selected.length === 0) {
      return;
    }

    if (selected.length === 1) {
      await this.deleteFolder(selected[0]);
      return;
    }

    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "deleteFoldersCount", placeholders: [selected.length] },
      content: { key: "deleteFoldersDescription" },
      acceptButtonText: { key: "delete" },
      cancelButtonText: { key: "cancel" },
      type: "danger",
    });

    if (!confirmed) {
      return;
    }

    await this.deleteFolders(
      selected.map((row) => row.id),
      "foldersDeleted",
    );
  };

  private async deleteFolders(ids: string[], successMessageKey: string): Promise<void> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));

    try {
      if (ids.length === 1) {
        await this.folderApiService.delete(ids[0], userId);
      } else {
        await this.folderApiService.deleteMany(ids, userId);
      }
    } catch (e) {
      this.logService.error("Error deleting folders", e);
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("errorOccurred"),
      });
      return;
    }

    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t(successMessageKey),
    });
  }
}
