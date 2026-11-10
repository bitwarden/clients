import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";

/**
 * The first section the member can reach, in side-nav order, rather than a static redirect that
 * would bounce anyone lacking that section's permission. Undefined when they reach none.
 */
export function pamLandingRoute(organization: Organization): string | undefined {
  if (organization.canManageAccessRules) {
    return "access-rules";
  }
  if (organization.usePam && organization.canAccessEventLogs) {
    return "audit";
  }
  if (organization.canManageRotation) {
    return "rotation";
  }
  return undefined;
}
