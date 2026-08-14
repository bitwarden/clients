import { inject, Injectable } from "@angular/core";
import { combineLatest, map, Observable, of, switchMap } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AvatarService } from "@bitwarden/common/auth/abstractions/avatar.service";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { getAvatarDefaultColor } from "@bitwarden/components";

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
        map(([orgs, dataOwnership, avatarColor]) =>
          this.buildViewModel(account, orgs, dataOwnership, avatarColor),
        ),
      );
    }),
  );

  private buildViewModel(
    account: Account,
    orgs: Organization[],
    dataOwnership: boolean,
    avatarColor: string | null,
  ): VaultsNavViewModel {
    const personalColor: VaultNavColor =
      avatarColor ?? getAvatarDefaultColor(account.id, account.name);

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

    // Under OrganizationDataOwnership the personal vault is not a peer; it surfaces as "My items" in the org section.
    const vaults = dataOwnership ? sortedOrgItems : [personalItem, ...sortedOrgItems];

    return {
      vaults,
      organizationDataOwnership: dataOwnership,
    };
  }

  private orgColor(org: Organization): VaultNavColor {
    return org.productTierType === ProductTierType.Families ? "teal" : "purple";
  }
}
