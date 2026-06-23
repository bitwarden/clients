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
} from "@bitwarden/vault";

import { openBulkDeleteDialog } from "./bulk-delete-dialog/bulk-delete-dialog.component";
import { BulkDeleteService } from "./services/bulk-delete.service";

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
      // Mixed selections (items + collections) fall through to the legacy dialog, which itemizes them.
      if (this.isCollectionsOnly(params) && !params.permanent) {
        return this.confirmAndDeleteCollections(params);
      }
      if (this.isItemsOnly(params)) {
        return this.confirmAndDeleteItems(params);
      }
    }

    const dialog = openBulkDeleteDialog(this.dialogService, { data: params });
    return lastValueFrom(dialog.closed.pipe(map((r) => r ?? BulkDeleteDialogResult.Canceled)));
  }

  /** True when the selection is collections only (no ciphers). */
  private isCollectionsOnly(params: BulkDeleteDialogParams): boolean {
    return (
      (params.collections?.length ?? 0) > 0 &&
      !params.cipherIds?.length &&
      !params.unassignedCiphers?.length
    );
  }

  /** True when the selection is items only (no collections). */
  private isItemsOnly(params: BulkDeleteDialogParams): boolean {
    return (
      (params.cipherIds?.length ?? 0) + (params.unassignedCiphers?.length ?? 0) > 0 &&
      !params.collections?.length
    );
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
      content:
        count === 1
          ? { key: "deleteCollectionConfirmation" }
          : { key: "deleteCollectionsConfirmation", placeholders: [count] },
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

  private itemDeleteTitle(permanent: boolean, count: number): Translation {
    if (count === 1) {
      return { key: permanent ? "permanentlyDeleteItem" : "deleteItem" };
    }
    return {
      key: permanent ? "permanentlyDeleteItemsCount" : "deleteItemsCount",
      placeholders: [count],
    };
  }

  private itemDeleteContent(permanent: boolean, count: number): Translation {
    if (!permanent) {
      return { key: "deleteItemConfirmation" };
    }
    return {
      key: count === 1 ? "permanentlyDeleteItemConfirmation" : "permanentlyDeleteItemsConfirmation",
    };
  }
}
