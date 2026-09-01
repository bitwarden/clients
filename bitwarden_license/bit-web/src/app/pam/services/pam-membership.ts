import { Observable, of, switchMap } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getOptionalUserId } from "@bitwarden/common/auth/services/account.service";

/**
 * The caller's organization memberships, for the PAM surfaces that need to ask something about the
 * organization a cipher or collection belongs to.
 *
 * One home for a pipeline that was being hand-rolled per surface: `getOptionalUserId` rather than
 * `getUserId`, because the latter throws on a signed-out account and would tear down the whole
 * stream; and an empty list rather than an error when there is no active account.
 */
export function callerOrganizations$(
  accountService: AccountService,
  organizationService: OrganizationService,
): Observable<Organization[]> {
  return accountService.activeAccount$.pipe(
    getOptionalUserId,
    switchMap((userId) => (userId == null ? of([]) : organizationService.organizations$(userId))),
  );
}

/**
 * Whether the caller is blocked from privileged access in `organizationId` by their own licensing
 * (PM-39423) — the organization is subscribed to PAM but they hold no seat against it.
 *
 * Presentation policy, which is why it lives here rather than on `Organization`: three of the four
 * conditions decide whether it is honest to SAY anything, not whether the member is entitled. Only
 * `canAccessPrivilegedAccess` is the entitlement, and only that is what the server evaluates.
 *
 * - not subscribed — an organization that never bought PAM has no license to be missing, so telling
 *   that member to ask their admin for one is nonsense.
 * - `accessPam === false`, not merely falsy — `OrganizationData` is rehydrated from persisted state,
 *   and a blob written before the field shipped carries `undefined`. Reading that as "unlicensed"
 *   would put an alarming, wrong message over every governed item until the next sync lands.
 * - disabled — a lapsed organization fails everything, and licensing is the wrong reason to give.
 * - provider user — `ProfileProviderOrganizationResponseModel` hardcodes `AccessPam = false` while
 *   still reporting the client organization's `UsePam`, so without this carve-out a provider admin
 *   would match on every governed cipher, and there is no seat they could ever be granted.
 *
 * A membership the caller has no record of yields `false`: they reached the item somehow, and a
 * subscription we cannot see is not something to invent a verdict about.
 */
export function unlicensedForPam(organization: Organization | undefined): boolean {
  return (
    organization != null &&
    organization.enabled &&
    organization.usePam &&
    organization.accessPam === false &&
    !organization.isProviderUser
  );
}
