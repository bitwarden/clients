import { map } from "rxjs";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { Provider } from "@bitwarden/common/admin-console/models/domain/provider";
import { Account } from "@bitwarden/common/auth/abstractions/account.service";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import {
  Maybe,
  OrganizationSubscriptionTiers,
  NonIndividualBitwardenSubscriber,
  BitwardenSubscriber,
} from "@bitwarden/subscription";

export class SubscriptionLibraryMapper {
  static mapAccount$ = map<Maybe<Account>, BitwardenSubscriber>((account) => {
    if (!account) {
      throw new Error("Could not find account");
    }
    return {
      type: "account",
      data: account,
    };
  });

  static mapOrganization = (organization: Organization): NonIndividualBitwardenSubscriber => ({
    type: "organization",
    data: {
      id: organization.id,
      name: organization.name,
      tier: this.mapProductTierType(organization.productTierType),
    },
  });

  static mapOrganization$ = map<Maybe<Organization>, NonIndividualBitwardenSubscriber>(
    (organization) => {
      if (!organization) {
        throw new Error("Could not find organization");
      }
      return this.mapOrganization(organization);
    },
  );

  static mapProvider$ = map<Maybe<Provider>, NonIndividualBitwardenSubscriber>((provider) => {
    if (!provider) {
      throw new Error("Could not find provider");
    }
    return {
      type: "provider",
      data: provider,
    };
  });

  private static mapProductTierType = (productTier: ProductTierType) => {
    switch (productTier) {
      case ProductTierType.Free:
        return OrganizationSubscriptionTiers.Free;
      case ProductTierType.Families:
        return OrganizationSubscriptionTiers.Families;
      case ProductTierType.Teams:
        return OrganizationSubscriptionTiers.Teams;
      case ProductTierType.TeamsStarter:
        return OrganizationSubscriptionTiers.TeamsStarter;
      case ProductTierType.Enterprise:
        return OrganizationSubscriptionTiers.Enterprise;
    }
  };
}
