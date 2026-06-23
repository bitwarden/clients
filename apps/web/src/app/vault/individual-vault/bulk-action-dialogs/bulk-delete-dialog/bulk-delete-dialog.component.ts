// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, Inject, inject } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  CenterPositionStrategy,
  DIALOG_DATA,
  DialogConfig,
  DialogRef,
  DialogService,
  ToastService,
} from "@bitwarden/components";
import {
  BulkDeleteDialogParams,
  BulkDeleteDialogResult,
  BulkDeleteService,
} from "@bitwarden/vault";

export { BulkDeleteDialogParams, BulkDeleteDialogResult };

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
    {
      positionStrategy: new CenterPositionStrategy(),
      ...config,
    },
  );
};

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "bulk-delete-dialog.component.html",
  standalone: false,
})
export class BulkDeleteDialogComponent {
  cipherIds: string[];
  permanent = false;
  organization: BulkDeleteDialogParams["organization"];
  organizations: BulkDeleteDialogParams["organizations"];
  collections: BulkDeleteDialogParams["collections"];
  unassignedCiphers: string[];

  private readonly bulkDelete = inject(BulkDeleteService);

  constructor(
    @Inject(DIALOG_DATA) params: BulkDeleteDialogParams,
    private dialogRef: DialogRef<BulkDeleteDialogResult>,
    private i18nService: I18nService,
    private toastService: ToastService,
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

    if (this.cipherIds.length || this.unassignedCiphers.length) {
      deletePromises.push(
        this.bulkDelete.deleteCiphers({
          cipherIds: this.cipherIds,
          unassignedCiphers: this.unassignedCiphers,
          permanent: this.permanent,
          organization: this.organization,
        }),
      );
    }

    if (this.collections.length) {
      deletePromises.push(this.deleteCollections());
    }

    await Promise.all(deletePromises);

    if (this.cipherIds.length || this.unassignedCiphers.length) {
      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t(this.permanent ? "permanentlyDeletedItems" : "deletedItems"),
      });
    }
    if (this.collections.length) {
      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("deletedCollections"),
      });
    }
    this.close(BulkDeleteDialogResult.Deleted);
  };

  private async deleteCollections(): Promise<void> {
    // From org vault
    if (this.organization) {
      if (this.collections.some((c) => !c.canDelete(this.organization))) {
        this.toastService.showToast({
          variant: "error",
          title: this.i18nService.t("errorOccurred"),
          message: this.i18nService.t("missingPermissions"),
        });
        return;
      }
      // From individual vault, so there can be multiple organizations
    } else if (this.organizations && this.collections) {
      for (const organization of this.organizations) {
        const orgCollections = this.collections.filter((o) => o.organizationId === organization.id);
        if (orgCollections.some((c) => !c.canDelete(organization))) {
          this.toastService.showToast({
            variant: "error",
            title: this.i18nService.t("errorOccurred"),
            message: this.i18nService.t("missingPermissions"),
          });
          return;
        }
      }
    } else {
      return;
    }

    await this.bulkDelete.deleteCollections(this.collections);
  }

  private close(result: BulkDeleteDialogResult) {
    void this.dialogRef.close(result);
  }
}
