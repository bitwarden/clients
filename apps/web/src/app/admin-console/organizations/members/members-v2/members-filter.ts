import { RevocationReasonType } from "@bitwarden/common/admin-console/enums";
import { OrganizationUserStatusType } from "@bitwarden/sdk-internal";

import { OrganizationUserView } from "../../core/views/organization-user.view";

/** The membership columns a chip can filter by, each keyed by the column it filters. */
export type MembershipKey = "groupNames" | "collectionNames";

/** A Status filter value: a member status, or a revocation reason nested under Revoked. */
export type StatusOption = OrganizationUserStatusType | `revoked-${RevocationReasonType}`;

export type MemberFilters = Partial<Record<MembershipKey, string[]>> & {
  search?: string;
  status?: StatusOption[];
};

/** The reasons nested under Revoked in the Status filter, in display order. */
export const REVOCATION_REASON_OPTIONS = [
  { value: "revoked-1", labelKey: "revocationReasonByAdmin" },
  { value: "revoked-3", labelKey: "revocationReasonDeclinedItemTransfer" },
  { value: "revoked-4", labelKey: "revocationReasonSingleOrganizationNonCompliance" },
  { value: "revoked-2", labelKey: "revocationReasonTwoFactorNonCompliance" },
  { value: "revoked-0", labelKey: "revocationReasonNotRecorded" },
] as const satisfies readonly { value: StatusOption; labelKey: string }[];

/**
 * Whether a member matches the Status filter. With nothing checked, every member but the revoked
 * ones shows. Revoked members match on their revocation reason, so checking Revoked (which checks
 * all of its reasons) shows them all.
 */
export function matchesStatus(member: OrganizationUserView, status?: StatusOption[]): boolean {
  if (!status?.length) {
    return member.status !== OrganizationUserStatusType.Revoked;
  }
  if (member.status === OrganizationUserStatusType.Revoked) {
    return status.includes(`revoked-${member.revocationReason ?? RevocationReasonType.Unknown}`);
  }
  return status.includes(member.status);
}
