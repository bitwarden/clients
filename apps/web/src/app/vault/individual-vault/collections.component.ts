import { DIALOG_DATA, DialogConfig, DialogRef } from "@angular/cdk/dialog";
import { Component, Inject, OnDestroy } from "@angular/core";

import { CollectionService, CollectionView } from "@bitwarden/admin-console/common";
import { CollectionsComponent as BaseCollectionsComponent } from "@bitwarden/angular/admin-console/components/collections.component";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { DialogService, ToastService } from "@bitwarden/components";

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
    organizationSerivce: OrganizationService,
    accountService: AccountService,
    protected dialogRef: DialogRef,
    @Inject(DIALOG_DATA) params: CollectionsDialogParams,
    toastService: ToastService,
  ) {
    super(
      collectionService,
      platformUtilsService,
      i18nService,
      cipherService,
      organizationSerivce,
      accountService,
      toastService,
    );
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
    if (!c.canEditItems(this.organization)) {
      return;
    }
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
