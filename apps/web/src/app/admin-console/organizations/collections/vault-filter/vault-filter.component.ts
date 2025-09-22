// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from "@angular/core";
import { firstValueFrom, Subject } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions/billing-api.service.abstraction";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";
import { DialogService, ToastService } from "@bitwarden/components";
import { CipherArchiveService } from "@bitwarden/vault";

import { VaultFilterComponent as BaseVaultFilterComponent } from "../../../../vault/individual-vault/vault-filter/components/vault-filter.component";
import { VaultFilterService } from "../../../../vault/individual-vault/vault-filter/services/abstractions/vault-filter.service";
import {
  VaultFilterList,
  VaultFilterSection,
  VaultFilterType,
} from "../../../../vault/individual-vault/vault-filter/shared/models/vault-filter-section.type";
import { CollectionFilter } from "../../../../vault/individual-vault/vault-filter/shared/models/vault-filter.type";

@Component({
  selector: "app-organization-vault-filter",
  templateUrl:
    "../../../../vault/individual-vault/vault-filter/components/vault-filter.component.html",
  standalone: false,
})
export class VaultFilterComponent
  extends BaseVaultFilterComponent
  implements OnInit, OnDestroy, OnChanges
{
  @Input() set organization(value: Organization) {
    if (value && value !== this._organization) {
      this._organization = value;
      this.vaultFilterService.setOrganizationFilter(this._organization);
    }
  }
  _organization: Organization;
  protected destroy$: Subject<void>;

  constructor(
    protected vaultFilterService: VaultFilterService,
    protected policyService: PolicyService,
    protected i18nService: I18nService,
    protected platformUtilsService: PlatformUtilsService,
    protected toastService: ToastService,
    protected billingApiService: BillingApiServiceAbstraction,
    protected dialogService: DialogService,
    protected accountService: AccountService,
    protected restrictedItemTypesService: RestrictedItemTypesService,
    protected cipherService: CipherService,
    protected cipherArchiveService: CipherArchiveService,
  ) {
    super(
      vaultFilterService,
      policyService,
      i18nService,
      platformUtilsService,
      toastService,
      billingApiService,
      dialogService,
      accountService,
      restrictedItemTypesService,
      cipherService,
      cipherArchiveService,
    );
  }

  async ngOnInit() {
    this.filters = await this.buildAllFilters();
    if (!this.activeFilter.selectedCipherTypeNode) {
      this.activeFilter.resetFilter();
      this.activeFilter.selectedCollectionNode =
        (await this.getDefaultFilter()) as TreeNode<CollectionFilter>;
    }
    this.isLoaded = true;
  }

  async ngOnChanges(changes: SimpleChanges) {
    if (changes.organization) {
      this.filters = await this.buildAllFilters();
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async removeCollapsibleCollection() {
    const collapsedNodes = await firstValueFrom(this.vaultFilterService.collapsedFilterNodes$);

    collapsedNodes.delete("AllCollections");
    const userId = await firstValueFrom(this.activeUserId$);
    await this.vaultFilterService.setCollapsedFilterNodes(collapsedNodes, userId);
  }

  protected async addCollectionFilter(): Promise<VaultFilterSection> {
    // Ensure the Collections filter is never collapsed for the org vault
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.removeCollapsibleCollection();

    const collectionFilterSection: VaultFilterSection = {
      data$: this.vaultFilterService.buildTypeTree(
        {
          id: "AllCollections",
          name: "collections",
          type: "all",
          icon: "bwi-collection-shared",
        },
        [
          {
            id: "AllCollections",
            name: "Collections",
            type: "all",
            icon: "bwi-collection-shared",
          },
        ],
      ),
      header: {
        showHeader: false,
        isSelectable: true,
      },
      action: this.applyCollectionFilter,
    };
    return collectionFilterSection;
  }

  async buildAllFilters(): Promise<VaultFilterList> {
    const builderFilter = {} as VaultFilterList;
    builderFilter.typeFilter = await this.addTypeFilter(["favorites"], this._organization?.id);
    builderFilter.collectionFilter = await this.addCollectionFilter();
    builderFilter.trashFilter = await this.addTrashFilter();
    return builderFilter;
  }

  async getDefaultFilter(): Promise<TreeNode<VaultFilterType>> {
    return await firstValueFrom(this.filters?.collectionFilter.data$);
  }
}
