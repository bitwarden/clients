import {
  Component,
  input,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
} from "@angular/core";
import {
  combineLatest,
  distinctUntilChanged,
  firstValueFrom,
  map,
  Observable,
  of,
  shareReplay,
  switchMap,
} from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions/billing-api.service.abstraction";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { CipherArchiveService } from "@bitwarden/common/vault/abstractions/cipher-archive.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";
import { CipherViewLikeUtils } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { DialogService, ToastService } from "@bitwarden/components";
import {
  VaultFilterServiceAbstraction,
  VaultFilterList,
  VaultFilterSection,
  VaultFilterType,
  CollectionFilter,
  CipherStatus,
  CipherTypeFilter,
} from "@bitwarden/vault";

import { VaultFilterComponent as BaseVaultFilterComponent } from "../../../../vault/individual-vault/vault-filter/components/vault-filter.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
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
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() set organization(value: Organization) {
    if (value && value !== this._organization) {
      this._organization = value;
      this.vaultFilterService.setOrganizationFilter(this._organization);
    }
  }
  _organization!: Organization;

  /** Org-scoped ciphers provided by the parent vault component. Used to build type filter badges
   * without triggering a personal vault decrypt. */
  readonly ciphers$ = input<Observable<CipherView[]>>(of([]));

  constructor(
    protected vaultFilterService: VaultFilterServiceAbstraction,
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
    premiumUpgradePromptService: PremiumUpgradePromptService,
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
      premiumUpgradePromptService,
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
      action: this.applyCollectionFilter as (
        filterNode: TreeNode<VaultFilterType>,
      ) => Promise<void>,
    };
    return collectionFilterSection;
  }

  protected override async addTypeFilter(
    excludeTypes: CipherStatus[] = [],
    organizationId?: string,
  ): Promise<VaultFilterSection> {
    const allFilter: CipherTypeFilter = {
      id: "AllItems",
      name: "allItems",
      type: "all",
    };

    const data$ = combineLatest([
      this.restrictedItemTypesService.restricted$,
      this.ciphers$(),
    ]).pipe(
      map(([restrictedTypes, ciphers]) => {
        const restrictedForUser = restrictedTypes
          .filter((r) => {
            if (r.allowViewOrgIds.length === 0) {
              return true;
            }
            return !ciphers?.some((c) => {
              if (c.deletedDate || CipherViewLikeUtils.getType(c) !== r.cipherType) {
                return false;
              }
              if (!c.organizationId) {
                return false;
              }
              if (organizationId && c.organizationId !== organizationId) {
                return false;
              }
              return r.allowViewOrgIds.includes(uuidAsString(c.organizationId));
            });
          })
          .map((r) => r.cipherType);

        const toExclude = [...excludeTypes, ...restrictedForUser];
        return this.allTypeFilters.filter((f) => !toExclude.includes(f.type));
      }),
      switchMap((allowed) => this.vaultFilterService.buildTypeTree(allFilter, allowed)),
      distinctUntilChanged(),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

    const typeFilterSection: VaultFilterSection = {
      data$,
      header: {
        showHeader: true,
        isSelectable: true,
      },
      action: this.applyTypeFilter as (filterNode: TreeNode<VaultFilterType>) => Promise<void>,
    };
    return typeFilterSection;
  }

  async buildAllFilters(): Promise<VaultFilterList> {
    const builderFilter = {} as VaultFilterList;
    builderFilter.typeFilter = await this.addTypeFilter(["favorites"], this._organization?.id);
    builderFilter.collectionFilter = await this.addCollectionFilter();
    builderFilter.trashFilter = await this.addTrashFilter();
    return builderFilter;
  }

  async getDefaultFilter(): Promise<TreeNode<VaultFilterType>> {
    return await firstValueFrom(this.filters!.collectionFilter!.data$);
  }
}
