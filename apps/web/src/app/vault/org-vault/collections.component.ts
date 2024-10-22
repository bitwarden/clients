import { DIALOG_DATA, DialogConfig, DialogRef } from "@angular/cdk/dialog";
import { Component, Inject } from "@angular/core";

import { CollectionService, CollectionView } from "@bitwarden/admin-console/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherData } from "@bitwarden/common/vault/models/data/cipher.data";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { CipherCollectionsRequest } from "@bitwarden/common/vault/models/request/cipher-collections.request";
import { DialogService, ToastService } from "@bitwarden/components";

import {
  CollectionsComponent as BaseCollectionsComponent,
  CollectionsDialogResult,
} from "../individual-vault/collections.component";

@Component({
  selector: "app-org-vault-collections",
  templateUrl: "../../vault/individual-vault/collections.component.html",
})
export class CollectionsComponent extends BaseCollectionsComponent {
  organization: Organization;

  constructor(
    collectionService: CollectionService,
    platformUtilsService: PlatformUtilsService,
    i18nService: I18nService,
    cipherService: CipherService,
    organizationService: OrganizationService,
    private apiService: ApiService,
    logService: LogService,
    accountService: AccountService,
    protected dialogRef: DialogRef,
    @Inject(DIALOG_DATA) params: OrgVaultCollectionsDialogParams,
    toastService: ToastService,
  ) {
    super(
      collectionService,
      platformUtilsService,
      i18nService,
      cipherService,
      organizationService,
      accountService,
      dialogRef,
      params,
      toastService,
    );
    this.allowSelectNone = true;
    this.collectionIds = params?.collectionIds;
    this.collections = params?.collections;
    this.organization = params?.organization;
    this.cipherId = params?.cipherId;
  }

  protected async loadCipher() {
    // if cipher is unassigned use apiService. We can see this by looking at this.collectionIds
    if (!this.organization.canEditAllCiphers && this.collectionIds.length !== 0) {
      return await super.loadCipher();
    }
    const response = await this.apiService.getCipherAdmin(this.cipherId);
    return new Cipher(new CipherData(response));
  }

  protected loadCipherCollections() {
    if (!this.organization.canViewAllCollections) {
      return super.loadCipherCollections();
    }
    return this.collectionIds;
  }

  protected loadCollections() {
    if (!this.organization.canViewAllCollections) {
      return super.loadCollections();
    }
    return Promise.resolve(this.collections);
  }

  protected saveCollections() {
    if (this.organization.canEditAllCiphers || this.collectionIds.length === 0) {
      const request = new CipherCollectionsRequest(this.cipherDomain.collectionIds);
      return this.apiService.putCipherCollectionsAdmin(this.cipherId, request);
    } else {
      return super.saveCollections();
    }
  }
}

export interface OrgVaultCollectionsDialogParams {
  collectionIds: string[];
  collections: CollectionView[];
  organization: Organization;
  cipherId: string;
}

/**
 * Strongly typed helper to open a Collections dialog
 * @param dialogService Instance of the dialog service that will be used to open the dialog
 * @param config Optional configuration for the dialog
 */
export function openOrgVaultCollectionsDialog(
  dialogService: DialogService,
  config?: DialogConfig<OrgVaultCollectionsDialogParams>,
) {
  return dialogService.open<CollectionsDialogResult, OrgVaultCollectionsDialogParams>(
    CollectionsComponent,
    config,
  );
}
