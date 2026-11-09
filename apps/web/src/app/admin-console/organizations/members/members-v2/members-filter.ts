import { OrganizationUserType, RevocationReasonType } from "@bitwarden/common/admin-console/enums";
import { OrganizationUserStatusType } from "@bitwarden/sdk-internal";

import { OrganizationUserView } from "../../core/views/organization-user.view";

/** A Status filter value: a member status, or a revocation reason nested under Revoked. */
export type StatusOption = OrganizationUserStatusType | `revoked-${RevocationReasonType}`;

/** A Products filter value. Const object + type, as enums fail `@bitwarden/platform/no-enums`. */
export const MemberProductFilter = Object.freeze({
  SecretsManager: "sm",
  PrivilegedControls: "pam",
} as const);
export type MemberProductFilter = (typeof MemberProductFilter)[keyof typeof MemberProductFilter];

/** An Account recovery option in the Policies filter. */
export const AccountRecoveryFilter = Object.freeze({
  Enrolled: "enrolled",
  NotEnrolled: "notEnrolled",
} as const);
export type AccountRecoveryFilter =
  (typeof AccountRecoveryFilter)[keyof typeof AccountRecoveryFilter];

/** A Two-step login option in the Policies filter. */
export const TwoFactorFilter = Object.freeze({
  Active: "active",
  Inactive: "inactive",
} as const);
export type TwoFactorFilter = (typeof TwoFactorFilter)[keyof typeof TwoFactorFilter];

/** A Policies filter value. Values are distinct across sections, so one array holds both. */
export type PolicyOption = AccountRecoveryFilter | TwoFactorFilter;

export type MemberFilters = {
  search?: string;
  status?: StatusOption[];
  role?: OrganizationUserType[];
  /** Group IDs, or collection IDs when the organization doesn't use groups. */
  access?: string[];
  product?: MemberProductFilter[];
  policies?: PolicyOption[];
};

/** The roles offered in the Role filter, in display order. */
export const ROLE_OPTIONS: readonly { value: OrganizationUserType; labelKey: string }[] = [
  { value: OrganizationUserType.Owner, labelKey: "owner" },
  { value: OrganizationUserType.Admin, labelKey: "admin" },
  { value: OrganizationUserType.User, labelKey: "user" },
  { value: OrganizationUserType.Custom, labelKey: "custom" },
];

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

/** Whether a member has one of the checked roles. With nothing checked, every member matches. */
export function matchesRole(member: OrganizationUserView, role?: OrganizationUserType[]): boolean {
  return !role?.length || role.includes(member.type);
}

/**
 * Whether a member is in any of the checked groups, or can access any of the checked collections
 * when the organization doesn't use groups. Matches on IDs, so groups sharing a name stay apart.
 */
export function matchesAccess(
  member: OrganizationUserView,
  ids: string[] | undefined,
  useGroups: boolean,
): boolean {
  if (!ids?.length) {
    return true;
  }
  const memberIds = useGroups ? member.groups : member.collections.map((c) => c.id);
  return memberIds.some((id) => ids.includes(id));
}

/** Whether a member has access to any of the checked products. */
export function matchesProduct(
  member: OrganizationUserView,
  product?: MemberProductFilter[],
): boolean {
  return (
    !product?.length ||
    (product.includes(MemberProductFilter.SecretsManager) && member.accessSecretsManager) ||
    (product.includes(MemberProductFilter.PrivilegedControls) && member.accessPam)
  );
}

/**
 * Whether a member matches the Policies filter. Options within a section combine with OR, and the
 * Account recovery and Two-step login sections combine with AND.
 */
export function matchesPolicies(member: OrganizationUserView, policies?: PolicyOption[]): boolean {
  const checked = new Set(policies);
  // A section with neither or both options checked doesn't narrow the list.
  const matchesSection = (yes: PolicyOption, no: PolicyOption, value: boolean) =>
    checked.has(yes) === checked.has(no) || checked.has(value ? yes : no);
  return (
    matchesSection(
      AccountRecoveryFilter.Enrolled,
      AccountRecoveryFilter.NotEnrolled,
      member.resetPasswordEnrolled,
    ) && matchesSection(TwoFactorFilter.Active, TwoFactorFilter.Inactive, member.twoFactorEnabled)
  );
}
