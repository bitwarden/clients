import { DialogConfig, DialogRef, DIALOG_DATA } from "@angular/cdk/dialog";
import { Component, Inject } from "@angular/core";

import { DialogServiceAbstraction } from "@bitwarden/angular/services/dialog";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";

export interface BulkRestoreDialogParams {
  cipherIds: string[];
  organization?: Organization;
}

export enum BulkRestoreDialogResult {
  Restored = "restored",
  Canceled = "canceled",
}

/**
 * Strongly typed helper to open a BulkRestoreDialog
 * @param dialogService Instance of the dialog service that will be used to open the dialog
 * @param config Configuration for the dialog
 */
export const openBulkRestoreDialog = (
  dialogService: DialogServiceAbstraction,
  config: DialogConfig<BulkRestoreDialogParams>
) => {
  return dialogService.open<BulkRestoreDialogResult, BulkRestoreDialogParams>(
    BulkRestoreDialogComponent,
    config
  );
};

@Component({
  templateUrl: "bulk-restore-dialog.component.html",
})
export class BulkRestoreDialogComponent {
  cipherIds: string[];
  organization?: Organization;

  constructor(
    @Inject(DIALOG_DATA) params: BulkRestoreDialogParams,
    private dialogRef: DialogRef<BulkRestoreDialogResult>,
    private cipherService: CipherService,
    private platformUtilsService: PlatformUtilsService,
    private i18nService: I18nService
  ) {
    this.cipherIds = params.cipherIds ?? [];
    this.organization = params.organization;
  }

  submit = async () => {
    const asAdmin = this.organization?.canEditAnyCollection;
    await this.cipherService.restoreManyWithServer(this.cipherIds, this.organization?.id, asAdmin);
    this.platformUtilsService.showToast("success", null, this.i18nService.t("restoredItems"));
    this.close(BulkRestoreDialogResult.Restored);
  };

  protected cancel() {
    this.close(BulkRestoreDialogResult.Canceled);
  }

  private close(result: BulkRestoreDialogResult) {
    this.dialogRef.close(result);
  }
}
