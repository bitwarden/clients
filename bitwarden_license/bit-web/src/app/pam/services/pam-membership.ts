import { Observable, of, switchMap } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getOptionalUserId } from "@bitwarden/common/auth/services/account.service";

/**
 * The caller's organization memberships, for PAM surfaces that need to ask something about the
 * organization a cipher or collection belongs to.
 *
 * One home for a hand-rolled-per-surface pipeline: `getOptionalUserId`, not `getUserId`, since
 * the latter throws on a signed-out account; an empty list, not an error, when there's no
 * active account.
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
 * Whether the caller is blocked from privileged access in `organizationId` by their own
 * licensing — the organization is subscribed to PAM but they hold no seat against it.
 *
 * Presentation policy, which is why it lives here, not on `Organization`: three of the four
 * conditions decide whether it's honest to say anything, not whether the member is entitled.
 * Only `canAccessPrivilegedAccess` is the entitlement the server evaluates.
 *
 * Not subscribed means no license to be missing; `accessPam === false` (not merely falsy) skips
 * a pre-field persisted blob reading as unlicensed; disabled is the wrong reason for a lapsed
 * org; and a provider user is carved out, since `ProfileProviderOrganizationResponseModel`
 * hardcodes `AccessPam = false` while still reporting the client org's `UsePam`.
 *
 * A membership the caller has no record of yields `false`, rather than inventing a verdict.
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
