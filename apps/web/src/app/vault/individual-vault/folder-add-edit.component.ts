// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { DIALOG_DATA, DialogConfig, DialogRef } from "@angular/cdk/dialog";
import { Component, Inject } from "@angular/core";
import { FormBuilder } from "@angular/forms";
import { firstValueFrom } from "rxjs";

import { FolderAddEditComponent as BaseFolderAddEditComponent } from "@bitwarden/angular/vault/components/folder-add-edit.component";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { FolderApiServiceAbstraction } from "@bitwarden/common/vault/abstractions/folder/folder-api.service.abstraction";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { DialogService, ToastService } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";

@Component({
  selector: "app-folder-add-edit",
  templateUrl: "folder-add-edit.component.html",
})
export class FolderAddEditComponent extends BaseFolderAddEditComponent {
  protected override componentName = "app-folder-add-edit";
  constructor(
    folderService: FolderService,
    folderApiService: FolderApiServiceAbstraction,
    protected accountSerivce: AccountService,
    protected keyService: KeyService,
    i18nService: I18nService,
    platformUtilsService: PlatformUtilsService,
    logService: LogService,
    dialogService: DialogService,
    formBuilder: FormBuilder,
    protected toastService: ToastService,
    protected dialogRef: DialogRef<FolderAddEditDialogResult>,
    @Inject(DIALOG_DATA) params: FolderAddEditDialogParams,
  ) {
    super(
      folderService,
      folderApiService,
      accountSerivce,
      keyService,
      i18nService,
      platformUtilsService,
      logService,
      dialogService,
      formBuilder,
      toastService,
    );
    // FIXME: Remove when updating file. Eslint update
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    params?.folderId ? (this.folderId = params.folderId) : null;
  }

  deleteAndClose = async () => {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "deleteFolder" },
      content: { key: "deleteFolderConfirmation" },
      type: "warning",
    });

    if (!confirmed) {
      return;
    }

    try {
      await this.folderApiService.delete(this.folder.id, await firstValueFrom(this.activeUserId$));
      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("deletedFolder"),
      });
    } catch (e) {
      this.logService.error(e);
    }

    this.dialogRef.close(FolderAddEditDialogResult.Deleted);
  };

  submitAndClose = async () => {
    this.folder.name = this.formGroup.controls.name.value;
    if (this.folder.name == null || this.folder.name === "") {
      this.formGroup.controls.name.markAsTouched();
      return;
    }

    try {
      const activeAccountId = await firstValueFrom(this.activeUserId$);
      const userKey = await this.keyService.getUserKeyWithLegacySupport(activeAccountId);
      const folder = await this.folderService.encrypt(this.folder, userKey);
      this.formPromise = this.folderApiService.save(folder, activeAccountId);
      await this.formPromise;
      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t(this.editMode ? "editedFolder" : "addedFolder"),
      });
      this.onSavedFolder.emit(this.folder);
      this.dialogRef.close(FolderAddEditDialogResult.Saved);
    } catch (e) {
      this.logService.error(e);
    }
    return;
  };
}

export interface FolderAddEditDialogParams {
  folderId: string;
}

export enum FolderAddEditDialogResult {
  Deleted = "deleted",
  Canceled = "canceled",
  Saved = "saved",
}

/**
 * Strongly typed helper to open a FolderAddEdit dialog
 * @param dialogService Instance of the dialog service that will be used to open the dialog
 * @param config Optional configuration for the dialog
 */
export function openFolderAddEditDialog(
  dialogService: DialogService,
  config?: DialogConfig<FolderAddEditDialogParams>,
) {
  return dialogService.open<FolderAddEditDialogResult, FolderAddEditDialogParams>(
    FolderAddEditComponent,
    config,
  );
}
