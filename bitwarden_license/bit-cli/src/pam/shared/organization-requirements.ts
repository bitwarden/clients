import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";

/**
 * What a caller must be able to do in an organization, checked cheaply from the synced
 * organization before any request is made. The server stays the authority: these only turn an
 * obvious refusal into a clear message, and a caller who passes may still be refused.
 */
export const PamOrganizationRequirement = Object.freeze({
  /** The organization uses PAM and the caller is not a provider user. The baseline for every check. */
  UsePam: "usePam",
  /**
   * The caller holds a PAM seat. Only for the verbs that need one: `request create`,
   * `request activate`, `lease extend` and `lease reveal`.
   */
  AccessPam: "accessPam",
  /** Writes to access rules. Reads and approver commands never need it. */
  ManageAccessRules: "manageAccessRules",
  /** Writes to connectors, target systems and rotation configs. */
  ManageRotation: "manageRotation",
} as const);
export type PamOrganizationRequirement =
  (typeof PamOrganizationRequirement)[keyof typeof PamOrganizationRequirement];

export const PAM_NOT_A_MEMBER_MESSAGE = "Organization not found, or you are not a member of it.";
const PAM_NOT_USED_MESSAGE = "This organization does not use Privileged Controls.";
const PAM_NO_ORGANIZATIONS_MESSAGE = "None of your organizations use Privileged Controls.";

/**
 * The refusal for `organization`, or `undefined` when the caller passes.
 * `UsePam` is always checked first, whatever `requirement` is.
 */
export function checkOrganizationRequirement(
  organization: Organization | undefined,
  requirement: PamOrganizationRequirement,
): string | undefined {
  if (organization == null) {
    return PAM_NOT_A_MEMBER_MESSAGE;
  }
  if (organization.isProviderUser) {
    return "Privileged Controls is not available to provider users.";
  }
  if (!organization.usePam) {
    return PAM_NOT_USED_MESSAGE;
  }

  switch (requirement) {
    case PamOrganizationRequirement.UsePam:
      return undefined;
    case PamOrganizationRequirement.AccessPam:
      return organization.canAccessPrivilegedAccess
        ? undefined
        : "You do not have a Privileged Controls seat in this organization. Ask an organization administrator to assign one.";
    case PamOrganizationRequirement.ManageAccessRules:
      return organization.canManageAccessRules
        ? undefined
        : "You do not have permission to manage access rules in this organization.";
    case PamOrganizationRequirement.ManageRotation:
      return organization.canManageRotation
        ? undefined
        : "You do not have permission to manage credential rotation in this organization.";
  }
}

/**
 * For verbs that name no organization, such as `request create`, whose organization is the
 * cipher's: passes when at least one organization satisfies `requirement`.
 */
export function checkAnyOrganizationRequirement(
  organizations: readonly Organization[],
  requirement: PamOrganizationRequirement,
): string | undefined {
  const refusals = organizations.map((o) => checkOrganizationRequirement(o, requirement));
  if (refusals.some((refusal) => refusal === undefined)) {
    return undefined;
  }
  const usingPam = organizations.filter((o) => o.usePam && !o.isProviderUser);
  return usingPam.length === 0
    ? PAM_NO_ORGANIZATIONS_MESSAGE
    : checkOrganizationRequirement(usingPam[0], requirement);
}
