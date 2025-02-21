// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { DialogConfig, DialogRef, DIALOG_DATA } from "@angular/cdk/dialog";
import { Component, Inject, OnDestroy, OnInit } from "@angular/core";
import { firstValueFrom, map } from "rxjs";

import { CollectionService, CollectionView } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { Checkable, isChecked } from "@bitwarden/common/types/checkable";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService, ToastService } from "@bitwarden/components";

export interface BulkShareDialogParams {
  ciphers: CipherView[];
  organizationId?: string;
}

export enum BulkShareDialogResult {
  Shared = "shared",
  Canceled = "canceled",
}

/**
 * Strongly typed helper to open a BulkShareDialog
 * @param dialogService Instance of the dialog service that will be used to open the dialog
 * @param config Configuration for the dialog
 */
export const openBulkShareDialog = (
  dialogService: DialogService,
  config: DialogConfig<BulkShareDialogParams>,
) => {
  return dialogService.open<BulkShareDialogResult, BulkShareDialogParams>(
    BulkShareDialogComponent,
    config,
  );
};

@Component({
  templateUrl: "bulk-share-dialog.component.html",
})
export class BulkShareDialogComponent implements OnInit, OnDestroy {
  ciphers: CipherView[] = [];
  organizationId: string;

  nonShareableCount = 0;
  collections: Checkable<CollectionView>[] = [];
  organizations: Organization[] = [];
  shareableCiphers: CipherView[] = [];

  private writeableCollections: CollectionView[] = [];

  constructor(
    @Inject(DIALOG_DATA) params: BulkShareDialogParams,
    private dialogRef: DialogRef<BulkShareDialogResult>,
    private cipherService: CipherService,
    private i18nService: I18nService,
    private collectionService: CollectionService,
    private organizationService: OrganizationService,
    private logService: LogService,
    private accountService: AccountService,
    private toastService: ToastService,
  ) {
    this.ciphers = params.ciphers ?? [];
    this.organizationId = params.organizationId;
  }

  async ngOnInit() {
    this.shareableCiphers = this.ciphers.filter(
      (c) => !c.hasOldAttachments && c.organizationId == null,
    );
    this.nonShareableCount = this.ciphers.length - this.shareableCiphers.length;
    const allCollections = await this.collectionService.getAllDecrypted();
    this.writeableCollections = allCollections.filter((c) => !c.readOnly);
    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
    this.organizations = await firstValueFrom(this.organizationService.organizations$(userId));
    if (this.organizationId == null && this.organizations.length > 0) {
      this.organizationId = this.organizations[0].id;
    }
    this.filterCollections();
  }

  ngOnDestroy() {
    this.selectAll(false);
  }

  filterCollections() {
    this.selectAll(false);
    if (this.organizationId == null || this.writeableCollections.length === 0) {
      this.collections = [];
    } else {
      this.collections = this.writeableCollections.filter(
        (c) => c.organizationId === this.organizationId,
      );
    }
  }

  submit = async () => {
    const checkedCollectionIds = this.collections.filter(isChecked).map((c) => c.id);
    try {
      const activeUserId = await firstValueFrom(
        this.accountService.activeAccount$.pipe(map((a) => a?.id)),
      );
      await this.cipherService.shareManyWithServer(
        this.shareableCiphers,
        this.organizationId,
        checkedCollectionIds,
        activeUserId,
      );
      const orgName =
        this.organizations.find((o) => o.id === this.organizationId)?.name ??
        this.i18nService.t("organization");
      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("movedItemsToOrg", orgName),
      });
      this.close(BulkShareDialogResult.Shared);
    } catch (e) {
      this.logService.error(e);
    }
  };

  check(c: Checkable<CollectionView>, select?: boolean) {
    c.checked = select == null ? !c.checked : select;
  }

  selectAll(select: boolean) {
    const collections = select ? this.collections : this.writeableCollections;
    collections.forEach((c) => this.check(c, select));
  }

  get canSave() {
    if (
      this.shareableCiphers != null &&
      this.shareableCiphers.length > 0 &&
      this.collections != null
    ) {
      for (let i = 0; i < this.collections.length; i++) {
        if (this.collections[i].checked) {
          return true;
        }
      }
    }
    return false;
  }

  protected cancel() {
    this.close(BulkShareDialogResult.Canceled);
  }

  private close(result: BulkShareDialogResult) {
    this.dialogRef.close(result);
  }
}
