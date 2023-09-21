import { DialogConfig, DialogRef, DIALOG_DATA } from "@angular/cdk/dialog";
import { Component, Inject } from "@angular/core";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { CollectionBulkDeleteRequest } from "@bitwarden/common/models/request/collection-bulk-delete.request";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherBulkDeleteRequest } from "@bitwarden/common/vault/models/request/cipher-bulk-delete.request";
import { DialogService } from "@bitwarden/components";

export interface BulkDeleteDialogParams {
  cipherIds?: string[];
  collectionIds?: string[];
  permanent?: boolean;
  organization?: Organization;
}

export enum BulkDeleteDialogResult {
  Deleted = "deleted",
  Canceled = "canceled",
}

/**
 * Strongly typed helper to open a BulkDeleteDialog
 * @param dialogService Instance of the dialog service that will be used to open the dialog
 * @param config Configuration for the dialog
 */
export const openBulkDeleteDialog = (
  dialogService: DialogService,
  config: DialogConfig<BulkDeleteDialogParams>
) => {
  return dialogService.open<BulkDeleteDialogResult, BulkDeleteDialogParams>(
    BulkDeleteDialogComponent,
    config
  );
};

@Component({
  templateUrl: "bulk-delete-dialog.component.html",
})
export class BulkDeleteDialogComponent {
  cipherIds: string[];
  collectionIds: string[];
  permanent = false;
  organization: Organization;

  constructor(
    @Inject(DIALOG_DATA) params: BulkDeleteDialogParams,
    private dialogRef: DialogRef<BulkDeleteDialogResult>,
    private cipherService: CipherService,
    private platformUtilsService: PlatformUtilsService,
    private i18nService: I18nService,
    private apiService: ApiService
  ) {
    this.cipherIds = params.cipherIds ?? [];
    this.collectionIds = params.collectionIds ?? [];
    this.permanent = params.permanent;
    this.organization = params.organization;
  }

  protected async cancel() {
    this.close(BulkDeleteDialogResult.Canceled);
  }

  protected submit = async () => {
    const deletePromises: Promise<void>[] = [];
    if (this.cipherIds.length) {
      if (!this.organization || !this.organization.canEditAnyCollection) {
        deletePromises.push(this.deleteCiphers());
      } else {
        deletePromises.push(this.deleteCiphersAdmin());
      }
    }

    if (this.collectionIds.length && this.organization) {
      deletePromises.push(this.deleteCollections());
    }

    await Promise.all(deletePromises);

    if (this.cipherIds.length) {
      this.platformUtilsService.showToast(
        "success",
        null,
        this.i18nService.t(this.permanent ? "permanentlyDeletedItems" : "deletedItems")
      );
    }
    if (this.collectionIds.length) {
      this.platformUtilsService.showToast(
        "success",
        null,
        this.i18nService.t("deletedCollections")
      );
    }
    this.close(BulkDeleteDialogResult.Deleted);
  };

  private async deleteCiphers(): Promise<any> {
    const asAdmin = this.organization?.canEditAnyCollection;
    if (this.permanent) {
      await this.cipherService.deleteManyWithServer(this.cipherIds, asAdmin);
    } else {
      await this.cipherService.softDeleteManyWithServer(this.cipherIds, asAdmin);
    }
  }

  private async deleteCiphersAdmin(): Promise<any> {
    const deleteRequest = new CipherBulkDeleteRequest(this.cipherIds, this.organization.id);
    if (this.permanent) {
      return await this.apiService.deleteManyCiphersAdmin(deleteRequest);
    } else {
      return await this.apiService.putDeleteManyCiphersAdmin(deleteRequest);
    }
  }

  private async deleteCollections(): Promise<any> {
    if (
      !this.organization.canDeleteAssignedCollections &&
      !this.organization.canDeleteAnyCollection
    ) {
      this.platformUtilsService.showToast(
        "error",
        this.i18nService.t("errorOccurred"),
        this.i18nService.t("missingPermissions")
      );
      return;
    }
    const deleteRequest = new CollectionBulkDeleteRequest(this.collectionIds, this.organization.id);
    return await this.apiService.deleteManyCollections(deleteRequest);
  }

  private close(result: BulkDeleteDialogResult) {
    this.dialogRef.close(result);
  }
}
