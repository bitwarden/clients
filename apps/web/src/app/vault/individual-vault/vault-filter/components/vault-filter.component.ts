// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, EventEmitter, inject, Input, OnDestroy, OnInit, Output } from "@angular/core";
import { Router } from "@angular/router";
import { firstValueFrom, merge, Subject, switchMap, takeUntil } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { BillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions/billing-api.service.abstraction";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";
import { DialogService, ToastService } from "@bitwarden/components";

import { TrialFlowService } from "../../../../billing/services/trial-flow.service";
import { VaultFilterService } from "../services/abstractions/vault-filter.service";
import {
  VaultFilterList,
  VaultFilterSection,
  VaultFilterType,
} from "../shared/models/vault-filter-section.type";
import { VaultFilter } from "../shared/models/vault-filter.model";
import {
  CipherStatus,
  CipherTypeFilter,
  CollectionFilter,
  FolderFilter,
  OrganizationFilter,
} from "../shared/models/vault-filter.type";

import { OrganizationOptionsComponent } from "./organization-options.component";

@Component({
  selector: "app-vault-filter",
  templateUrl: "vault-filter.component.html",
})
export class VaultFilterComponent implements OnInit, OnDestroy {
  filters?: VaultFilterList;
  @Input() activeFilter: VaultFilter = new VaultFilter();
  @Output() onEditFolder = new EventEmitter<FolderFilter>();

  @Input() searchText = "";
  @Output() searchTextChanged = new EventEmitter<string>();

  isLoaded = false;

  protected destroy$: Subject<void> = new Subject<void>();
  private router = inject(Router);
  get filtersList() {
    return this.filters ? Object.values(this.filters) : [];
  }

  get searchPlaceholder() {
    if (this.activeFilter.isFavorites) {
      return "searchFavorites";
    }
    if (this.activeFilter.isDeleted) {
      return "searchTrash";
    }
    if (this.activeFilter.cipherType === CipherType.Login) {
      return "searchLogin";
    }
    if (this.activeFilter.cipherType === CipherType.Card) {
      return "searchCard";
    }
    if (this.activeFilter.cipherType === CipherType.Identity) {
      return "searchIdentity";
    }
    if (this.activeFilter.cipherType === CipherType.SecureNote) {
      return "searchSecureNote";
    }
    if (this.activeFilter.cipherType === CipherType.SshKey) {
      return "searchSshKey";
    }
    if (this.activeFilter.selectedFolderNode?.node) {
      return "searchFolder";
    }
    if (this.activeFilter.selectedCollectionNode?.node) {
      return "searchCollection";
    }
    if (this.activeFilter.organizationId === "MyVault") {
      return "searchMyVault";
    }
    if (this.activeFilter.organizationId) {
      return "searchOrganization";
    }

    return "searchVault";
  }

  private trialFlowService = inject(TrialFlowService);

  constructor(
    protected vaultFilterService: VaultFilterService,
    protected policyService: PolicyService,
    protected i18nService: I18nService,
    protected platformUtilsService: PlatformUtilsService,
    protected toastService: ToastService,
    protected billingApiService: BillingApiServiceAbstraction,
    protected dialogService: DialogService,
    protected configService: ConfigService,
  ) {}

  async ngOnInit(): Promise<void> {
    this.filters = await this.buildAllFilters();
    this.activeFilter.selectedCipherTypeNode =
      (await this.getDefaultFilter()) as TreeNode<CipherTypeFilter>;
    this.isLoaded = true;

    // Without refactoring the entire component, we need to manually update the organization filter whenever the policies update
    merge(
      this.policyService.get$(PolicyType.SingleOrg),
      this.policyService.get$(PolicyType.PersonalOwnership),
    )
      .pipe(
        switchMap(() => this.addOrganizationFilter()),
        takeUntil(this.destroy$),
      )
      .subscribe((orgFilters) => {
        this.filters.organizationFilter = orgFilters;
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSearchTextChanged(t: string) {
    this.searchText = t;
    this.searchTextChanged.emit(t);
  }

  applyOrganizationFilter = async (orgNode: TreeNode<OrganizationFilter>): Promise<void> => {
    if (!orgNode?.node.enabled) {
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("disabledOrganizationFilterError"),
      });
      const metadata = await this.billingApiService.getOrganizationBillingMetadata(orgNode.node.id);
      await this.trialFlowService.handleUnpaidSubscriptionDialog(orgNode.node, metadata);
    }
    const filter = this.activeFilter;
    if (orgNode?.node.id === "AllVaults") {
      filter.resetOrganization();
    } else {
      filter.selectedOrganizationNode = orgNode;
    }
    this.vaultFilterService.setOrganizationFilter(orgNode.node);
    await this.vaultFilterService.expandOrgFilter();
  };

  applyTypeFilter = async (filterNode: TreeNode<CipherTypeFilter>): Promise<void> => {
    const filter = this.activeFilter;
    filter.resetFilter();
    filter.selectedCipherTypeNode = filterNode;
  };

  applyFolderFilter = async (folderNode: TreeNode<FolderFilter>): Promise<void> => {
    const filter = this.activeFilter;
    filter.resetFilter();
    filter.selectedFolderNode = folderNode;
  };

  applyCollectionFilter = async (collectionNode: TreeNode<CollectionFilter>): Promise<void> => {
    const filter = this.activeFilter;
    filter.resetFilter();
    filter.selectedCollectionNode = collectionNode;
  };

  editFolder = async (folder: FolderFilter): Promise<void> => {
    this.onEditFolder.emit(folder);
  };

  async getDefaultFilter(): Promise<TreeNode<VaultFilterType>> {
    return await firstValueFrom(this.filters?.typeFilter.data$);
  }

  async buildAllFilters(): Promise<VaultFilterList> {
    const builderFilter = {} as VaultFilterList;
    builderFilter.organizationFilter = await this.addOrganizationFilter();
    builderFilter.typeFilter = await this.addTypeFilter();
    builderFilter.folderFilter = await this.addFolderFilter();
    builderFilter.collectionFilter = await this.addCollectionFilter();
    builderFilter.trashFilter = await this.addTrashFilter();
    return builderFilter;
  }

  protected async addOrganizationFilter(): Promise<VaultFilterSection> {
    const singleOrgPolicy = await this.policyService.policyAppliesToUser(PolicyType.SingleOrg);
    const personalVaultPolicy = await this.policyService.policyAppliesToUser(
      PolicyType.PersonalOwnership,
    );

    const addAction = !singleOrgPolicy
      ? { text: "newOrganization", route: "/create-organization" }
      : null;

    const orgFilterSection: VaultFilterSection = {
      data$: this.vaultFilterService.organizationTree$,
      header: {
        showHeader: !(singleOrgPolicy && personalVaultPolicy),
        isSelectable: true,
      },
      action: this.applyOrganizationFilter,
      options: { component: OrganizationOptionsComponent },
      add: addAction,
      divider: true,
    };

    return orgFilterSection;
  }

  protected async addTypeFilter(excludeTypes: CipherStatus[] = []): Promise<VaultFilterSection> {
    const allTypeFilters: CipherTypeFilter[] = [
      {
        id: "favorites",
        name: this.i18nService.t("favorites"),
        type: "favorites",
        icon: "bwi-star",
      },
      {
        id: "login",
        name: this.i18nService.t("typeLogin"),
        type: CipherType.Login,
        icon: "bwi-globe",
      },
      {
        id: "card",
        name: this.i18nService.t("typeCard"),
        type: CipherType.Card,
        icon: "bwi-credit-card",
      },
      {
        id: "identity",
        name: this.i18nService.t("typeIdentity"),
        type: CipherType.Identity,
        icon: "bwi-id-card",
      },
      {
        id: "note",
        name: this.i18nService.t("typeSecureNote"),
        type: CipherType.SecureNote,
        icon: "bwi-sticky-note",
      },
    ];

    if (await this.configService.getFeatureFlag(FeatureFlag.SSHKeyVaultItem)) {
      allTypeFilters.push({
        id: "sshKey",
        name: this.i18nService.t("typeSshKey"),
        type: CipherType.SshKey,
        icon: "bwi-key",
      });
    }

    const typeFilterSection: VaultFilterSection = {
      data$: this.vaultFilterService.buildTypeTree(
        { id: "AllItems", name: "allItems", type: "all", icon: "" },
        allTypeFilters.filter((f) => !excludeTypes.includes(f.type)),
      ),
      header: {
        showHeader: true,
        isSelectable: true,
      },
      action: this.applyTypeFilter,
    };
    return typeFilterSection;
  }

  protected async addFolderFilter(): Promise<VaultFilterSection> {
    const folderFilterSection: VaultFilterSection = {
      data$: this.vaultFilterService.folderTree$,
      header: {
        showHeader: true,
        isSelectable: false,
      },
      action: this.applyFolderFilter,
      edit: {
        text: "editFolder",
        action: this.editFolder,
      },
    };
    return folderFilterSection;
  }

  protected async addCollectionFilter(): Promise<VaultFilterSection> {
    const collectionFilterSection: VaultFilterSection = {
      data$: this.vaultFilterService.collectionTree$,
      header: {
        showHeader: true,
        isSelectable: true,
      },
      action: this.applyCollectionFilter,
    };
    return collectionFilterSection;
  }

  protected async addTrashFilter(): Promise<VaultFilterSection> {
    const trashFilterSection: VaultFilterSection = {
      data$: this.vaultFilterService.buildTypeTree(
        {
          id: "headTrash",
          name: "HeadTrash",
          type: "trash",
          icon: "bwi-trash",
        },
        [
          {
            id: "trash",
            name: this.i18nService.t("trash"),
            type: "trash",
            icon: "bwi-trash",
          },
        ],
      ),
      header: {
        showHeader: false,
        isSelectable: true,
      },
      action: this.applyTypeFilter,
    };
    return trashFilterSection;
  }
}
