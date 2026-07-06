import { Injectable, inject } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogService, ToastService, Translation } from "@bitwarden/components";
import {
  BulkDeleteDialogParams,
  BulkDeleteDialogRef,
  BulkDeleteDialogResult,
  BulkDeleteService,
} from "@bitwarden/vault";

@Injectable()
export class BulkDeleteDialogDesktopAdapter implements BulkDeleteDialogRef {
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);
  private readonly bulkDelete = inject(BulkDeleteService);

  async open(params: BulkDeleteDialogParams): Promise<BulkDeleteDialogResult> {
    if (this.hasItems(params) && this.hasCollections(params)) {
      return this.confirmAndDeleteMixed(params);
    }
    if (this.hasCollections(params)) {
      return this.confirmAndDeleteCollections(params);
    }
    if (this.hasItems(params)) {
      return this.confirmAndDeleteItems(params);
    }
    return BulkDeleteDialogResult.Canceled;
  }

  private hasItems(params: BulkDeleteDialogParams): boolean {
    return (params.cipherIds?.length ?? 0) + (params.unassignedCiphers?.length ?? 0) > 0;
  }

  private hasCollections(params: BulkDeleteDialogParams): boolean {
    return (params.collections?.length ?? 0) > 0;
  }

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
      message: this.i18nService.t(permanent ? "permanentlyDeletedItems" : "deletedItems"),
    });

    return BulkDeleteDialogResult.Deleted;
  }

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
      message: this.i18nService.t("deletedItems"),
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
