import { map } from "rxjs";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { Provider } from "@bitwarden/common/admin-console/models/domain/provider";
import { Account } from "@bitwarden/common/auth/abstractions/account.service";

export type BillableEntity =
  | { type: "account"; data: Account }
  | { type: "organization"; data: Organization }
  | { type: "provider"; data: Provider };

export const accountToBillableEntity = map<Account | null, BillableEntity>((account) => {
  if (!account) {
    throw new Error("Account not found");
  }
  return {
    type: "account",
    data: account,
  };
});

export const organizationToBillableEntity = map<Organization | undefined, BillableEntity>(
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

export const providerToBillableEntity = map<Provider | null, BillableEntity>((provider) => {
  if (!provider) {
    throw new Error("Organization not found");
  }
  return {
    type: "provider",
    data: provider,
  };
});
