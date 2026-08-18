import type { AccessAuditEventResponse } from "./responses/access-audit-event.response";

/**
 * The one governance-facing read of the PAM access-audit trail, as raw HTTP.
 *
 * The one exception to this module's rule that PAM calls go through the Rust SDK. The server
 * implements `GET /organizations/{orgId}/audit`, but the pinned commercial SDK's `pam()` client
 * exposes only `access_requests()`, `access_rules()`, `leases()`, and the approver surface; there is
 * no audit client, so there is no SDK call to make. Binding this behind an abstraction means the
 * eventual swap is a provider change in `provide-pam.ts` and nothing else.
 *
 * Closing this exception is SDK work: an `audit` module on the `bitwarden-pam` crate. See the
 * follow-up note in this directory's README.
 */
export abstract class AuditApiService {
  /**
   * `GET /organizations/{orgId}/audit` — the organization's access-audit trail within the shared
   * history window, newest first, with each action's before/after pair already collapsed to one
   * entry by the server.
   *
   * Org-scoped and authorized by the AccessEventLogs permission, so this returns the whole
   * organization's trail regardless of which collections the caller manages. A caller without that
   * permission gets a 404 rather than an empty list.
   */
  abstract listAccessAuditTrail(organizationId: string): Promise<AccessAuditEventResponse[]>;
}
