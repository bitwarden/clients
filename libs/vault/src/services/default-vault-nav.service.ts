import { inject, Injectable } from "@angular/core";
import { combineLatest, map, Observable, of, shareReplay, switchMap } from "rxjs";

// eslint-disable-next-line no-restricted-imports
import { CollectionService } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AvatarService } from "@bitwarden/common/auth/abstractions/avatar.service";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CollectionId, OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { getAvatarDefaultColor } from "@bitwarden/components";

import { getOrgIconForTier } from "../components/org-icon.directive";
import {
  VaultNavColor,
  VaultNavItemType,
  VaultNavItemViewModel,
  VaultsNavViewModel,
} from "../models/vault-nav-view-model";

import { VaultNavService } from "./vault-nav.service";

@Injectable()
export class DefaultVaultNavService extends VaultNavService {
  private readonly organizationService = inject(OrganizationService);
  private readonly policyService = inject(PolicyService);
  private readonly avatarService = inject(AvatarService);
  private readonly collectionService = inject(CollectionService);
  private readonly i18nService = inject(I18nService);

  /**
   * Built once per user and shared, the way the sibling per-user vault services cache theirs: the
   * side nav, the vault page, and the route guard all read this, and each would otherwise stand up
   * its own organization, policy, and collection subscriptions.
   */
  private readonly viewModelCache = new Map<UserId, Observable<VaultsNavViewModel>>();

  viewModel$(userId: UserId): Observable<VaultsNavViewModel> {
    const cached = this.viewModelCache.get(userId);
    if (cached != null) {
      return cached;
    }

    const viewModel$ = combineLatest([
      this.organizationService.memberOrganizations$(userId),
      this.policyService.policyAppliesToUser$(PolicyType.OrganizationDataOwnership, userId),
      this.avatarService.getUserAvatarColor$(userId),
    ]).pipe(
      switchMap(([orgs, dataOwnership, avatarColor]) => {
        if (!(dataOwnership && orgs.length > 0)) {
          return of(this.buildViewModel(userId, orgs, dataOwnership, avatarColor, new Map()));
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
              userId,
              orgs,
              dataOwnership,
              avatarColor,
              new Map<string, CollectionId | undefined>(entries),
            ),
          ),
        );
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

    this.viewModelCache.set(userId, viewModel$);
    return viewModel$;
  }

  private buildViewModel(
    userId: UserId,
    orgs: Organization[],
    dataOwnership: boolean,
    avatarColor: string | null,
    defaultUserCollectionIds: Map<string, CollectionId | undefined>,
  ): VaultsNavViewModel {
    // The account's own id seeds the default palette, so the avatar's name fallback never applies.
    const personalColor: VaultNavColor = avatarColor ?? getAvatarDefaultColor(userId);

    const personalItem: VaultNavItemViewModel = {
      id: userId,
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
