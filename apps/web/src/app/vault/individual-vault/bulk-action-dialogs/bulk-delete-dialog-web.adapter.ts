import { Injectable, inject } from "@angular/core";
import { lastValueFrom } from "rxjs";
import { map } from "rxjs/operators";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogService, ToastService, Translation } from "@bitwarden/components";
import {
  BulkDeleteDialogParams,
  BulkDeleteDialogRef,
  BulkDeleteDialogResult,
  BulkDeleteService,
} from "@bitwarden/vault";

import { openBulkDeleteDialog } from "./bulk-delete-dialog/bulk-delete-dialog.component";

@Injectable()
export class BulkDeleteDialogWebAdapter implements BulkDeleteDialogRef {
  private readonly dialogService = inject(DialogService);
  private readonly configService = inject(ConfigService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);
  private readonly bulkDelete = inject(BulkDeleteService);

  async open(params: BulkDeleteDialogParams): Promise<BulkDeleteDialogResult> {
    const batchBarEnabled = await this.configService.getFeatureFlag(
      FeatureFlag.PM37785_VaultBatchBar,
    );

    if (batchBarEnabled) {
      if (this.hasItems(params) && this.hasCollections(params)) {
        return this.confirmAndDeleteMixed(params);
      }
      if (this.hasCollections(params)) {
        return this.confirmAndDeleteCollections(params);
      }
      if (this.hasItems(params)) {
        return this.confirmAndDeleteItems(params);
      }
    }

    const dialog = openBulkDeleteDialog(this.dialogService, { data: params });
    return lastValueFrom(dialog.closed.pipe(map((r) => r ?? BulkDeleteDialogResult.Canceled)));
  }

  private hasItems(params: BulkDeleteDialogParams): boolean {
    return (params.cipherIds?.length ?? 0) + (params.unassignedCiphers?.length ?? 0) > 0;
  }

  private hasCollections(params: BulkDeleteDialogParams): boolean {
    return (params.collections?.length ?? 0) > 0;
  }

  /**
   * Confirms via the standard danger dialog, then deletes the items. Permission checks are performed
   * upstream by the batch bar before the dialog is opened.
   */
  private async confirmAndDeleteItems(
    params: BulkDeleteDialogParams,
  ): Promise<BulkDeleteDialogResult> {
    const cipherIds = params.cipherIds ?? [];
    const unassignedCiphers = params.unassignedCiphers ?? [];
    const count = cipherIds.length + unassignedCiphers.length;
    const permanent = params.permanent ?? false;

    const confirmed = await this.dialogService.openSimpleDialog({
      type: "danger",
      title: this.itemDeleteTitle(permanent, count),
      content: this.itemDeleteContent(permanent, count),
      acceptButtonText: { key: "delete" },
      cancelButtonText: { key: "cancel" },
    });

    if (!confirmed) {
      return BulkDeleteDialogResult.Canceled;
    }

    await this.bulkDelete.deleteCiphers({
      cipherIds,
      unassignedCiphers,
      permanent,
      organization: params.organization,
    });

    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t(
        permanent
          ? count === 1
            ? "permanentlyDeletedItem"
            : "permanentlyDeletedItems"
          : count === 1
            ? "deletedItem"
            : "deletedItems",
      ),
    });

    return BulkDeleteDialogResult.Deleted;
  }

  /**
   * Confirms via the standard danger dialog, then deletes the collections. Permission checks are
   * performed upstream by the batch bar before the dialog is opened.
   */
  private async confirmAndDeleteCollections(
    params: BulkDeleteDialogParams,
  ): Promise<BulkDeleteDialogResult> {
    const collections = params.collections ?? [];
    const count = collections.length;

    const confirmed = await this.dialogService.openSimpleDialog({
      type: "danger",
      title:
        count === 1
          ? { key: "deleteCollection" }
          : { key: "deleteCollectionsCount", placeholders: [count] },
      content: { key: count === 1 ? "deleteCollectionDesc" : "deleteCollectionsDesc" },
      acceptButtonText: { key: "delete" },
      cancelButtonText: { key: "cancel" },
    });

    if (!confirmed) {
      return BulkDeleteDialogResult.Canceled;
    }

    await this.bulkDelete.deleteCollections(collections);

    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t(count === 1 ? "collectionDeleted" : "collectionsDeleted"),
    });

    return BulkDeleteDialogResult.Deleted;
  }

  /**
   * Confirms via the standard danger dialog, then deletes the selected items and collections.
   * Items are sent to the trash; collections are permanently deleted. Permission checks are
   * performed upstream by the batch bar before the dialog is opened.
   */
  private async confirmAndDeleteMixed(
    params: BulkDeleteDialogParams,
  ): Promise<BulkDeleteDialogResult> {
    const cipherIds = params.cipherIds ?? [];
    const unassignedCiphers = params.unassignedCiphers ?? [];
    const collections = params.collections ?? [];

    const confirmed = await this.dialogService.openSimpleDialog({
      type: "danger",
      title: { key: "deleteSelection" },
      content: { key: "deleteItemsAndCollectionsDesc" },
      acceptButtonText: { key: "delete" },
      cancelButtonText: { key: "cancel" },
    });

    if (!confirmed) {
      return BulkDeleteDialogResult.Canceled;
    }

    const cipherCount = cipherIds.length + unassignedCiphers.length;

    await Promise.all([
      this.bulkDelete.deleteCiphers({
        cipherIds,
        unassignedCiphers,
        permanent: false,
        organization: params.organization,
      }),
      this.bulkDelete.deleteCollections(collections),
    ]);

    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t(cipherCount === 1 ? "deletedItem" : "deletedItems"),
    });
    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t(
        collections.length === 1 ? "collectionDeleted" : "collectionsDeleted",
      ),
    });

    return BulkDeleteDialogResult.Deleted;
  }

  private itemDeleteTitle(permanent: boolean, count: number): Translation {
    if (count === 1) {
      return { key: permanent ? "deleteItemPermanently" : "deleteItem" };
    }
    return {
      key: permanent ? "deleteItemsPermanentlyCount" : "deleteItemsCount",
      placeholders: [count],
    };
  }

  private itemDeleteContent(permanent: boolean, count: number): Translation {
    if (permanent) {
      return { key: count === 1 ? "deleteItemPermanentlyDesc" : "deleteItemsPermanentlyDesc" };
    }
    return { key: count === 1 ? "deleteItemDesc" : "deleteItemsDesc" };
  }
}
