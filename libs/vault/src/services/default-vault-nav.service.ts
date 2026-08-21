import { inject, Injectable } from "@angular/core";
import { combineLatest, map, Observable, of, shareReplay, switchMap } from "rxjs";

// eslint-disable-next-line no-restricted-imports
import { CollectionService } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AvatarService } from "@bitwarden/common/auth/abstractions/avatar.service";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { getAvatarDefaultColor } from "@bitwarden/components";

import { getOrgIconForTier } from "../components/org-icon.directive";
import {
  VaultNavColor,
  VaultNavItemType,
  VaultNavItemViewModel,
  VaultsNavViewModel,
} from "../models/vault-nav-view-model";

import { VaultNavService } from "./vault-nav.service";

const EMPTY_VIEW_MODEL: VaultsNavViewModel = {
  vaults: [],
  organizationDataOwnership: false,
};

@Injectable()
export class DefaultVaultNavService extends VaultNavService {
  private readonly accountService = inject(AccountService);
  private readonly organizationService = inject(OrganizationService);
  private readonly policyService = inject(PolicyService);
  private readonly avatarService = inject(AvatarService);
  private readonly collectionService = inject(CollectionService);
  private readonly i18nService = inject(I18nService);

  readonly viewModel$: Observable<VaultsNavViewModel> = this.accountService.activeAccount$.pipe(
    switchMap((account) => {
      if (!account) {
        return of(EMPTY_VIEW_MODEL);
      }
      const userId = account.id;
      return combineLatest([
        this.organizationService.memberOrganizations$(userId),
        this.policyService.policyAppliesToUser$(PolicyType.OrganizationDataOwnership, userId),
        this.avatarService.getUserAvatarColor$(userId),
      ]).pipe(
        switchMap(([orgs, dataOwnership, avatarColor]) => {
          if (!(dataOwnership && orgs.length > 0)) {
            return of(this.buildViewModel(account, orgs, dataOwnership, avatarColor, new Map()));
          }
          return combineLatest(
            orgs.map((org) =>
              this.collectionService
                .defaultUserCollection$(userId, org.id as OrganizationId)
                .pipe(map((collection) => [org.id, collection?.id] as const)),
            ),
          ).pipe(
            map((entries) =>
              this.buildViewModel(
                account,
                orgs,
                dataOwnership,
                avatarColor,
                new Map<string, CollectionId | undefined>(entries),
              ),
            ),
          );
        }),
      );
    }),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  private buildViewModel(
    account: Account,
    orgs: Organization[],
    dataOwnership: boolean,
    avatarColor: string | null,
    defaultUserCollectionIds: Map<string, CollectionId | undefined>,
  ): VaultsNavViewModel {
    const personalColor: VaultNavColor =
      avatarColor ?? getAvatarDefaultColor(account.id, account.name);

    const personalItem: VaultNavItemViewModel = {
      id: account.id,
      label: this.i18nService.t("myVault"),
      color: personalColor,
      icon: "bwi-user",
      type: VaultNavItemType.Personal,
    };

    const sortedOrgItems: VaultNavItemViewModel[] = [...orgs]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((org) => ({
        id: org.id,
        label: org.name,
        color: this.orgColor(org),
        icon: getOrgIconForTier(org.productTierType),
        type: this.orgType(org),
        defaultUserCollectionId: defaultUserCollectionIds.get(org.id),
      }));

    const ownershipApplies = dataOwnership && sortedOrgItems.length > 0;
    const vaults = ownershipApplies ? sortedOrgItems : [personalItem, ...sortedOrgItems];

    return {
      vaults,
      organizationDataOwnership: ownershipApplies,
    };
  }

  private orgType(org: Organization): VaultNavItemType {
    switch (org.productTierType) {
      case ProductTierType.Free:
      case ProductTierType.Families:
        return VaultNavItemType.Family;
      default:
        return VaultNavItemType.Organization;
    }
  }

  private orgColor(org: Organization): VaultNavColor {
    return this.orgType(org) === VaultNavItemType.Family ? "teal" : "purple";
  }
}
