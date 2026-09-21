import { SafeInjectionToken } from "@bitwarden/ui-common";

/**
 * The Admin Console path holding the commercial PAM feature's organization-scoped pages, relative
 * to `/organizations/{id}`.
 *
 * Read `{ optional: true }` by `getOrganizationRoute`, so an OSS-only build, which mounts no such
 * pages, never lands a member on it.
 */
export const PAM_ORG_ADMIN_ROUTE = new SafeInjectionToken<string>("PamOrgAdminRoute");
