import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";

export type OrganizationFreeTrialWarning = {
  organization: Pick<Organization, "id" & "name">;
  message: string;
};

export type OrganizationResellerRenewalWarning = {
  type: "info" | "warning";
  message: string;
};
