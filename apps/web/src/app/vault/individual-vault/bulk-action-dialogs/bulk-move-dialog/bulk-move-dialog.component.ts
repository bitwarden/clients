import { DialogConfig, DialogRef, DIALOG_DATA } from "@angular/cdk/dialog";
import { Component, Inject, OnInit } from "@angular/core";
import { FormBuilder, Validators } from "@angular/forms";
import { firstValueFrom, Observable } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { DialogService } from "@bitwarden/components";

export interface BulkMoveDialogParams {
  cipherIds?: string[];
}

export enum BulkMoveDialogResult {
  Moved = "moved",
  Canceled = "canceled",
}

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

@Component({
  templateUrl: "bulk-move-dialog.component.html",
})
export class BulkMoveDialogComponent implements OnInit {
  cipherIds: string[] = [];

  formGroup = this.formBuilder.group({
    folderId: ["", [Validators.nullValidator]],
  });
  folders$: Observable<FolderView[]>;

  protected vaultBulkManagementActionEnabled$ = this.configService.getFeatureFlag$(
    FeatureFlag.VaultBulkManagementAction,
  );

  constructor(
    @Inject(DIALOG_DATA) params: BulkMoveDialogParams,
    private dialogRef: DialogRef<BulkMoveDialogResult>,
    private cipherService: CipherService,
    private platformUtilsService: PlatformUtilsService,
    private i18nService: I18nService,
    private folderService: FolderService,
    private formBuilder: FormBuilder,
    private configService: ConfigService,
  ) {
    this.cipherIds = params.cipherIds ?? [];
  }

  async ngOnInit() {
    this.folders$ = this.folderService.folderViews$;
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

    await this.cipherService.moveManyWithServer(this.cipherIds, this.formGroup.value.folderId);
    this.platformUtilsService.showToast("success", null, this.i18nService.t("movedItems"));
    this.close(BulkMoveDialogResult.Moved);
  };

  private close(result: BulkMoveDialogResult) {
    this.dialogRef.close(result);
  }
}
