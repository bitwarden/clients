import { DIALOG_DATA, DialogConfig, DialogRef } from "@angular/cdk/dialog";
import { Component, OnDestroy, Inject } from "@angular/core";

import { CollectionsComponent as BaseCollectionsComponent } from "@bitwarden/angular/admin-console/components/collections.component";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CollectionService } from "@bitwarden/common/vault/abstractions/collection.service";
import { CollectionView } from "@bitwarden/common/vault/models/view/collection.view";
import { DialogService } from "@bitwarden/components";

@Component({
  selector: "app-vault-collections",
  templateUrl: "collections.component.html",
})
export class CollectionsComponent extends BaseCollectionsComponent implements OnDestroy {
  constructor(
    collectionService: CollectionService,
    platformUtilsService: PlatformUtilsService,
    i18nService: I18nService,
    cipherService: CipherService,
    logService: LogService,
    protected dialogRef: DialogRef,
    @Inject(DIALOG_DATA) params: CollectionsDialogParams,
  ) {
    super(collectionService, platformUtilsService, i18nService, cipherService, logService);
    this.cipherId = params?.cipherId;
  }

  override async submit(): Promise<boolean> {
    const success = await super.submit();
    if (success) {
      this.dialogRef.close(CollectionsDialogResult.Saved);
      return true;
    }
    return false;
  }

  check(c: CollectionView, select?: boolean) {
    (c as any).checked = select == null ? !(c as any).checked : select;
  }

  selectAll(select: boolean) {
    this.collections.forEach((c) => this.check(c, select));
  }

  ngOnDestroy() {
    this.selectAll(false);
  }
}

export interface CollectionsDialogParams {
  cipherId: string;
}

export enum CollectionsDialogResult {
  Saved = "saved",
}

/**
 * Strongly typed helper to open a Collections dialog
 * @param dialogService Instance of the dialog service that will be used to open the dialog
 * @param config Optional configuration for the dialog
 */
export function openIndividualVaultCollectionsDialog(
  dialogService: DialogService,
  config?: DialogConfig<CollectionsDialogParams>,
) {
  return dialogService.open<CollectionsDialogResult, CollectionsDialogParams>(
    CollectionsComponent,
    config,
  );
}
