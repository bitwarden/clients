import { inject, Injectable } from "@angular/core";
import { combineLatest, map, Observable, of, switchMap } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { getAvatarDefaultColor } from "@bitwarden/common/platform/misc/avatar-color";
import { UserId } from "@bitwarden/common/types/guid";

import {
  VaultNavColor,
  VaultNavItemType,
  VaultNavItemViewModel,
  VaultsNavViewModel,
} from "../models/vault-nav-view-model";

import { VaultNavService } from "./vault-nav.service";

const EMPTY_VIEW_MODEL: VaultsNavViewModel = {
  showVaultsHeader: false,
  vaults: [],
  myVaultItem: null,
  allItemsItem: null,
  orgDefaultExpanded: false,
  showMyItemsGroup: false,
};

@Injectable()
export class DefaultVaultNavService extends VaultNavService {
  private readonly accountService = inject(AccountService);
  private readonly organizationService = inject(OrganizationService);
  private readonly policyService = inject(PolicyService);
  private readonly billingService = inject(BillingAccountProfileStateService);
  private readonly i18nService = inject(I18nService);

  readonly viewModel$: Observable<VaultsNavViewModel> = this.accountService.activeAccount$.pipe(
    switchMap((account) => {
      if (!account) {
        return of(EMPTY_VIEW_MODEL);
      }
      const userId = account.id as UserId;
      return combineLatest([
        this.organizationService.memberOrganizations$(userId),
        this.billingService.hasPremiumFromAnySource$(userId),
        this.policyService.policyAppliesToUser$(PolicyType.OrganizationDataOwnership, userId),
      ]).pipe(
        map(([orgs, hasPremium, dataOwnership]) =>
          this.buildViewModel(account, orgs, hasPremium, dataOwnership),
        ),
      );
    }),
  );

  private buildViewModel(
    account: Account,
    orgs: Organization[],
    hasPremium: boolean,
    dataOwnership: boolean,
  ): VaultsNavViewModel {
    const personalColor = getAvatarDefaultColor(account.id, account.name);

    if (orgs.length === 0) {
      if (hasPremium) {
        return {
          ...EMPTY_VIEW_MODEL,
          allItemsItem: {
            id: "all-items",
            label: this.i18nService.t("allItems"),
            color: "brand",
            type: VaultNavItemType.AllItems,
          },
        };
      }
      return {
        ...EMPTY_VIEW_MODEL,
        myVaultItem: {
          id: account.id,
          label: this.i18nService.t("myVault"),
          color: personalColor,
          type: VaultNavItemType.Personal,
        },
      };
    }

    const personalItem: VaultNavItemViewModel = {
      id: account.id,
      label: this.i18nService.t("myVault"),
      color: personalColor,
      type: VaultNavItemType.Personal,
    };

    const sortedOrgItems: VaultNavItemViewModel[] = [...orgs]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((org) => ({
        id: org.id,
        label: org.name,
        color: this.orgColor(org),
        type:
          org.productTierType === ProductTierType.Families
            ? VaultNavItemType.Family
            : VaultNavItemType.Organization,
      }));

    return {
      showVaultsHeader: !dataOwnership,
      vaults: [personalItem, ...sortedOrgItems],
      myVaultItem: null,
      allItemsItem: null,
      orgDefaultExpanded: dataOwnership,
      showMyItemsGroup: dataOwnership,
    };
  }

  private orgColor(org: Organization): VaultNavColor {
    return org.productTierType === ProductTierType.Families ? "teal" : "purple";
  }
}
