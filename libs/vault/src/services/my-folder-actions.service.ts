import { Injectable, inject } from "@angular/core";
import { firstValueFrom, lastValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { FolderApiServiceAbstraction } from "@bitwarden/common/vault/abstractions/folder/folder-api.service.abstraction";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { DialogService, ToastService } from "@bitwarden/components";

import { AddEditFolderDialogComponent } from "../components/add-edit-folder-dialog/add-edit-folder-dialog.component";
import { openDeleteFolderDialog } from "../components/delete-folder-dialog/delete-folder-dialog.component";

export type MyFolderToDelete = {
  id: string;

  /** The name the confirmation shows, standing in for a folder with no name. */
  displayName: string;
};

/**
 * What a user can do to one of their own folders from the My folders table and from a folder's
 * own page, so both open the same dialogs and report the same outcomes.
 */
@Injectable({ providedIn: "root" })
export class MyFolderActionsService {
  private readonly accountService = inject(AccountService);
  private readonly dialogService = inject(DialogService);
  private readonly folderApiService = inject(FolderApiServiceAbstraction);
  private readonly folderService = inject(FolderService);
  private readonly i18nService = inject(I18nService);
  private readonly logService = inject(LogService);
  private readonly toastService = inject(ToastService);

  /** Opens the edit dialog for a folder. Does nothing for a folder the user does not hold. */
  async edit(folderId: string): Promise<void> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const folder = await firstValueFrom(this.folderService.getDecrypted$(folderId, userId));

    if (folder == null) {
      return;
    }

    await lastValueFrom(
      AddEditFolderDialogComponent.open(this.dialogService, {
        editFolderConfig: { folder: { ...folder } },
        hideDelete: true,
      }).closed,
    );
  }

  /**
   * Confirms, then deletes a folder. Resolves to whether the folder was deleted: `false` when the
   * confirmation was cancelled or the delete failed.
   */
  async delete(folder: MyFolderToDelete): Promise<boolean> {
    const confirmed = await lastValueFrom(
      openDeleteFolderDialog(this.dialogService, { folderName: folder.displayName }).closed,
    );

    if (!confirmed) {
      return false;
    }

    return await this.deleteFolders([folder.id], "deletedFolder");
  }

  /**
   * Deletes folders without asking, and shows {@link successMessageKey}'s toast once they are gone.
   * Resolves to whether they were deleted, after showing an error toast when they were not.
   */
  async deleteFolders(ids: string[], successMessageKey: string): Promise<boolean> {
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
      return false;
    }

    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t(successMessageKey),
    });
    return true;
  }
}
