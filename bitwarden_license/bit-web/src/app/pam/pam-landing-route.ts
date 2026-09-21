import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";

/**
 * The PAM section to land a member on when they arrive at `/organizations/{id}/pam` itself, in the
 * side nav's own order. Undefined when they hold none of the three, which leaves
 * `organizationRedirectGuard` to send them back out to the console's own landing arm.
 *
 * A static redirect to `access-rules` cannot serve this: each section is a separate authority, so
 * a Custom member holding only `ManageRotation` — or only the event-log permission — would be
 * bounced straight back out by that route's own guard.
 */
export function pamLandingRoute(organization: Organization): string | undefined {
  if (organization.canManageAccessRules) {
    return "access-rules";
  }
  if (organization.canAccessEventLogs) {
    return "audit";
  }
  if (organization.canManageRotation) {
    return "rotation";
  }
  return undefined;
}
