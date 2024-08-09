import { DIALOG_DATA, DialogConfig, DialogRef } from "@angular/cdk/dialog";
import { Component, Inject } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CollectionService } from "@bitwarden/common/vault/abstractions/collection.service";
import { CipherBulkDeleteRequest } from "@bitwarden/common/vault/models/request/cipher-bulk-delete.request";
import { CollectionView } from "@bitwarden/common/vault/models/view/collection.view";
import { DialogService } from "@bitwarden/components";

export interface BulkDeleteDialogParams {
  cipherIds?: string[];
  permanent?: boolean;
  organization?: Organization;
  organizations?: Organization[];
  collections?: CollectionView[];
  unassignedCiphers?: string[];
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
  config: DialogConfig<BulkDeleteDialogParams>,
) => {
  return dialogService.open<BulkDeleteDialogResult, BulkDeleteDialogParams>(
    BulkDeleteDialogComponent,
    config,
  );
};

@Component({
  templateUrl: "bulk-delete-dialog.component.html",
})
export class BulkDeleteDialogComponent {
  cipherIds: string[];
  permanent = false;
  organization: Organization;
  organizations: Organization[];
  collections: CollectionView[];
  unassignedCiphers: string[];

  private restrictProviderAccess$ = this.configService.getFeatureFlag$(
    FeatureFlag.RestrictProviderAccess,
  );

  constructor(
    @Inject(DIALOG_DATA) params: BulkDeleteDialogParams,
    private dialogRef: DialogRef<BulkDeleteDialogResult>,
    private cipherService: CipherService,
    private platformUtilsService: PlatformUtilsService,
    private i18nService: I18nService,
    private apiService: ApiService,
    private collectionService: CollectionService,
    private configService: ConfigService,
  ) {
    this.cipherIds = params.cipherIds ?? [];
    this.permanent = params.permanent;
    this.organization = params.organization;
    this.organizations = params.organizations;
    this.collections = params.collections;
    this.unassignedCiphers = params.unassignedCiphers || [];
  }

  protected async cancel() {
    this.close(BulkDeleteDialogResult.Canceled);
  }

  protected submit = async () => {
    const deletePromises: Promise<void>[] = [];
    const restrictProviderAccess = await firstValueFrom(this.restrictProviderAccess$);

    // Unassigned ciphers under an Owner/Admin OR Custom Users With Edit will call the deleteCiphersAdmin method
    if (
      this.unassignedCiphers.length &&
      this.organization.canEditUnassignedCiphers(restrictProviderAccess)
    ) {
      deletePromises.push(this.deleteCiphersAdmin(this.unassignedCiphers));
    }
    if (this.cipherIds.length) {
      const restrictProviderAccess = await firstValueFrom(this.restrictProviderAccess$);

      if (!this.organization || !this.organization.canEditAllCiphers(restrictProviderAccess)) {
        deletePromises.push(this.deleteCiphers());
      } else {
        deletePromises.push(this.deleteCiphersAdmin(this.cipherIds));
      }
    }

    if (this.collections.length) {
      deletePromises.push(this.deleteCollections());
    }

    await Promise.all(deletePromises);

    if (this.cipherIds.length || this.unassignedCiphers.length) {
      this.platformUtilsService.showToast(
        "success",
        null,
        this.i18nService.t(this.permanent ? "permanentlyDeletedItems" : "deletedItems"),
      );
    }
    if (this.collections.length) {
      await this.collectionService.delete(this.collections.map((c) => c.id));
      this.platformUtilsService.showToast(
        "success",
        null,
        this.i18nService.t("deletedCollections"),
      );
    }
    this.close(BulkDeleteDialogResult.Deleted);
  };

  private async deleteCiphers(): Promise<any> {
    const restrictProviderAccess = await firstValueFrom(this.restrictProviderAccess$);
    const asAdmin = this.organization?.canEditAllCiphers(restrictProviderAccess);
    if (this.permanent) {
      await this.cipherService.deleteManyWithServer(this.cipherIds, asAdmin);
    } else {
      await this.cipherService.softDeleteManyWithServer(this.cipherIds, asAdmin);
    }
  }

  private async deleteCiphersAdmin(ciphers: string[]): Promise<any> {
    const deleteRequest = new CipherBulkDeleteRequest(ciphers, this.organization.id);
    if (this.permanent) {
      return await this.apiService.deleteManyCiphersAdmin(deleteRequest);
    } else {
      return await this.apiService.putDeleteManyCiphersAdmin(deleteRequest);
    }
  }

  private async deleteCollections(): Promise<any> {
    // From org vault
    if (this.organization) {
      if (this.collections.some((c) => !c.canDelete(this.organization))) {
        this.platformUtilsService.showToast(
          "error",
          this.i18nService.t("errorOccurred"),
          this.i18nService.t("missingPermissions"),
        );
        return;
      }
      return await this.apiService.deleteManyCollections(
        this.organization.id,
        this.collections.map((c) => c.id),
      );
      // From individual vault, so there can be multiple organizations
    } else if (this.organizations && this.collections) {
      const deletePromises: Promise<any>[] = [];
      for (const organization of this.organizations) {
        const orgCollections = this.collections.filter((o) => o.organizationId === organization.id);
        if (orgCollections.some((c) => !c.canDelete(organization))) {
          this.platformUtilsService.showToast(
            "error",
            this.i18nService.t("errorOccurred"),
            this.i18nService.t("missingPermissions"),
          );
          return;
        }
        const orgCollectionIds = orgCollections.map((c) => c.id);
        deletePromises.push(
          this.apiService.deleteManyCollections(organization.id, orgCollectionIds),
        );
      }
      return await Promise.all(deletePromises);
    }
  }

  private close(result: BulkDeleteDialogResult) {
    this.dialogRef.close(result);
  }
}
