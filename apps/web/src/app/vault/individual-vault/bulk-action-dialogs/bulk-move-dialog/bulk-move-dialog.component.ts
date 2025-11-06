// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, Inject, OnInit } from "@angular/core";
import { FormBuilder, Validators } from "@angular/forms";
import { firstValueFrom, Observable } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { UnionOfValues } from "@bitwarden/common/vault/types/union-of-values";
import {
  DialogConfig,
  DialogRef,
  DIALOG_DATA,
  DialogService,
  ToastService,
} from "@bitwarden/components";

export interface BulkMoveDialogParams {
  cipherIds?: string[];
}

export const BulkMoveDialogResult = {
  Moved: "moved",
  Canceled: "canceled",
} as const;

type BulkMoveDialogResult = UnionOfValues<typeof BulkMoveDialogResult>;

/**
 * Strongly typed helper to open a BulkMoveDialog
 * @param dialogService Instance of the dialog service that will be used to open the dialog
 * @param config Configuration for the dialog
 */
export const openBulkMoveDialog = (
  dialogService: DialogService,
  config: DialogConfig<BulkMoveDialogParams>,
) => {
  return dialogService.open<BulkMoveDialogResult, BulkMoveDialogParams>(
    BulkMoveDialogComponent,
    config,
  );
};

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "bulk-move-dialog.component.html",
  standalone: false,
})
export class BulkMoveDialogComponent implements OnInit {
  cipherIds: string[] = [];

  formGroup = this.formBuilder.group({
    folderId: ["", [Validators.nullValidator]],
  });
  folders$: Observable<FolderView[]>;

  constructor(
    @Inject(DIALOG_DATA) params: BulkMoveDialogParams,
    private dialogRef: DialogRef<BulkMoveDialogResult>,
    private cipherService: CipherService,
    private platformUtilsService: PlatformUtilsService,
    private i18nService: I18nService,
    private folderService: FolderService,
    private formBuilder: FormBuilder,
    private toastService: ToastService,
    private accountService: AccountService,
  ) {
    this.cipherIds = params.cipherIds ?? [];
  }

  async ngOnInit() {
    const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    this.folders$ = this.folderService.folderViews$(activeUserId);
    this.formGroup.patchValue({
      folderId: (await firstValueFrom(this.folders$))[0].id,
    });
  }

  protected cancel() {
    this.close(BulkMoveDialogResult.Canceled);
  }

  protected submit = async () => {
    if (this.formGroup.invalid) {
      return;
    }

    const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    await this.cipherService.moveManyWithServer(
      this.cipherIds,
      this.formGroup.value.folderId,
      activeUserId,
    );
    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("movedItems"),
    });
    this.close(BulkMoveDialogResult.Moved);
  };

  private close(result: BulkMoveDialogResult) {
    this.dialogRef.close(result);
  }
}
