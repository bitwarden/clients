import { Injectable, OnDestroy } from "@angular/core";
import { map, Observable, ReplaySubject, Subject } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { CollectionAdminView } from "@bitwarden/common/admin-console/models/collections";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { StateProvider } from "@bitwarden/common/platform/state";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";
import { VaultFilterService as BaseVaultFilterService, CollectionFilter } from "@bitwarden/vault";

@Injectable()
export class VaultFilterService extends BaseVaultFilterService implements OnDestroy {
  private destroy$ = new Subject<void>();
  private _collections = new ReplaySubject<CollectionAdminView[]>(1);

  filteredCollections$: Observable<CollectionAdminView[]> = this._collections.asObservable();

  collectionTree$: Observable<TreeNode<CollectionFilter>> = this.filteredCollections$.pipe(
    map((collections) => this.buildCollectionTree(collections)),
  );

  constructor(
    organizationService: OrganizationService,
    folderService: FolderService,
    cipherService: CipherService,
    policyService: PolicyService,
    i18nService: I18nService,
    stateProvider: StateProvider,
    collectionService: CollectionService,
    accountService: AccountService,
  ) {
    super(
      organizationService,
      folderService,
      cipherService,
      policyService,
      i18nService,
      stateProvider,
      collectionService,
      accountService,
    );
  }

  async reloadCollections(collections: CollectionAdminView[]) {
    this._collections.next(collections);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
