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

/**
 * The label and display position of each revocation reason in the Status filter. Keyed by
 * {@link RevocationReasonType}, so a new reason doesn't compile until it has an entry here.
 */
const REVOCATION_REASONS = {
  [RevocationReasonType.Manual]: { labelKey: "revocationReasonByAdmin", order: 0 },
  [RevocationReasonType.OrganizationDataOwnershipPolicyNonCompliance]: {
    labelKey: "revocationReasonDeclinedItemTransfer",
    order: 1,
  },
  [RevocationReasonType.SingleOrgPolicyNonCompliance]: {
    labelKey: "revocationReasonSingleOrganizationNonCompliance",
    order: 2,
  },
  [RevocationReasonType.TwoFactorPolicyNonCompliance]: {
    labelKey: "revocationReasonTwoFactorNonCompliance",
    order: 3,
  },
  [RevocationReasonType.Unknown]: { labelKey: "revocationReasonNotRecorded", order: 4 },
} as const satisfies Record<RevocationReasonType, { labelKey: string; order: number }>;

/** The reasons nested under Revoked in the Status filter, in display order. */
export const REVOCATION_REASON_OPTIONS: readonly { value: StatusOption; labelKey: string }[] =
  Object.values(RevocationReasonType)
    .sort((a, b) => REVOCATION_REASONS[a].order - REVOCATION_REASONS[b].order)
    .map((reason) => ({
      value: `revoked-${reason}`,
      labelKey: REVOCATION_REASONS[reason].labelKey,
    }));

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
