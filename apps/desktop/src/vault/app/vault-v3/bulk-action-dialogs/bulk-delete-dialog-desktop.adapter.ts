import { Injectable, inject } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogService, ToastService, Translation } from "@bitwarden/components";
import {
  BulkDeleteDialogParams,
  BulkDeleteDialogRef,
  BulkDeleteDialogResult,
  BulkDeleteService,
  Vfo1TerminologyService,
} from "@bitwarden/vault";

@Injectable()
export class BulkDeleteDialogDesktopAdapter implements BulkDeleteDialogRef {
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);
  private readonly bulkDelete = inject(BulkDeleteService);
  private readonly vfo1TerminologyService = inject(Vfo1TerminologyService);

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

  private async confirmAndDeleteCollections(
    params: BulkDeleteDialogParams,
  ): Promise<BulkDeleteDialogResult> {
    const collections = params.collections ?? [];
    const count = collections.length;

    const confirmed = await this.dialogService.openSimpleDialog({
      type: "danger",
      title: this.collectionDeleteTitle(count),
      content: this.collectionDeleteContent(count),
      acceptButtonText: { key: "delete" },
      cancelButtonText: { key: "cancel" },
    });

    if (!confirmed) {
      return BulkDeleteDialogResult.Canceled;
    }

    await this.bulkDelete.deleteCollections(collections);

    this.toastService.showToast({
      variant: "success",
      message: this.collectionDeletedMessage(count),
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
      content: {
        key: this.vfo1TerminologyService.enabled()
          ? "deleteItemsAndSharedFoldersDesc"
          : "deleteItemsAndCollectionsDesc",
      },
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
      message: this.collectionDeletedMessage(collections.length),
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

  private collectionDeleteTitle(count: number): Translation {
    const sharedFolder = this.vfo1TerminologyService.enabled();
    if (count === 1) {
      return { key: sharedFolder ? "deleteSharedFolder" : "deleteCollection" };
    }
    return {
      key: sharedFolder ? "deleteSharedFoldersCount" : "deleteCollectionsCount",
      placeholders: [count],
    };
  }

  private collectionDeleteContent(count: number): Translation {
    const sharedFolder = this.vfo1TerminologyService.enabled();
    if (count === 1) {
      return { key: sharedFolder ? "deleteSharedFolderKeepItemsDesc" : "deleteCollectionDesc" };
    }
    return { key: sharedFolder ? "deleteSharedFoldersKeepItemsDesc" : "deleteCollectionsDesc" };
  }

  private collectionDeletedMessage(count: number): string {
    const sharedFolder = this.vfo1TerminologyService.enabled();
    if (count === 1) {
      return this.i18nService.t(sharedFolder ? "sharedFolderDeleted" : "collectionDeleted");
    }
    return this.i18nService.t(sharedFolder ? "sharedFoldersDeleted" : "collectionsDeleted");
  }
}
