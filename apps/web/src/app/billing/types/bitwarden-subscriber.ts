import { map } from "rxjs";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { Provider } from "@bitwarden/common/admin-console/models/domain/provider";
import { Account } from "@bitwarden/common/auth/abstractions/account.service";

export type BitwardenSubscriber =
  | { type: "account"; data: Account }
  | { type: "organization"; data: Organization }
  | { type: "provider"; data: Provider };

export type NonIndividualSubscriber = Exclude<BitwardenSubscriber, { type: "account" }>;

export const mapAccountToSubscriber = map<Account | null, BitwardenSubscriber>((account) => {
  if (!account) {
    throw new Error("Account not found");
  }
  return {
    type: "account",
    data: account,
  };
});

export const mapOrganizationToSubscriber = map<Organization | undefined, BitwardenSubscriber>(
  (organization) => {
    if (!organization) {
      throw new Error("Organization not found");
    }
    return {
      type: "organization",
      data: organization,
    };
  },
);

export const mapProviderToSubscriber = map<Provider | null, BitwardenSubscriber>((provider) => {
  if (!provider) {
    throw new Error("Organization not found");
  }
  return {
    type: "provider",
    data: provider,
  };
});
