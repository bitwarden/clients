import { SafeInjectionToken } from "@bitwarden/ui-common";

/**
 * Admin Console path of the commercial PAM organization pages, relative to `/organizations/{id}`.
 * Injected optionally, so an OSS-only build never lands a member on it.
 */
export const PAM_ORG_ADMIN_ROUTE = new SafeInjectionToken<string>("PamOrgAdminRoute");
