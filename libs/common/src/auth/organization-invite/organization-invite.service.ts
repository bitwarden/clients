import { Observable } from "rxjs";

import { UserId } from "@bitwarden/user-core";

import { MasterPasswordPolicyOptions } from "../../admin-console/models/domain/master-password-policy-options";
import { Policy } from "../../admin-console/models/domain/policy";

import { OpenOrgInviteStatusResult } from "./open-org-invite-status-result";
import { OrganizationInvite } from "./organization-invite";

/**
 * Owns the in-flight organization invite: persisted across login/register/MP-policy
 * detours, then consumed when the user accepts (or stashed and reloaded if an MP
 * policy check redirects them through re-auth first).
 */
export abstract class OrganizationInviteService {
  /**
   * Merged stream of the variant-specific state keys, prefering direct over open.
   * At most one is non-null at a time per the mutual-exclusion invariant enforced by
   * {@link setOrganizationInvite}.
   */
  abstract activeInvite$: Observable<OrganizationInvite | null>;

  /**
   * Returns the currently stored organization invite (direct or open).
   */
  abstract getOrganizationInvite(): Promise<OrganizationInvite | null>;

  /**
   * Stores a new organization invite. Writes to the state key matching `invite.kind`
   * and clears the opposite key (mutual exclusion). Callers that want to remove the
   * stored invite should use {@link clearOrganizationInvite} or {@link clearOpenOrgInvite}.
   */
  abstract setOrganizationInvite(invite: OrganizationInvite): Promise<void>;

  /**
   * Clears both variant-specific state keys defensively. Use this for general "I'm done
   * with any pending invite" cleanup. For open-only cleanup that must not affect a
   * concurrent direct invite, use {@link clearOpenOrgInvite}.
   */
  abstract clearOrganizationInvite(): Promise<void>;

  /**
   * Clears only the open-invite state key. Used by the open-invite landing-page error
   * path so a malformed open-invite URL cannot wipe a concurrent stashed direct invite.
   */
  abstract clearOpenOrgInvite(): Promise<void>;

  /**
   * Accepts the invite for the active user, or stashes it and logs out if the user must
   * first satisfy the org's master-password policy. The stashed invite is consumed when
   * the user returns after re-authenticating with a compliant master password.
   * @returns true if the invite was accepted; false if it was stashed pending re-auth.
   */
  abstract validateAndAcceptInvite(invite: OrganizationInvite, userId: UserId): Promise<boolean>;

  /**
   * Fetches all enabled policies for the inviting organization, authenticated via the invite token
   * (no user session required). Callers filter by `PolicyType` for their needs (e.g. `MasterPassword`,
   * `ResetPassword`). Results are cached on the service instance keyed by invite token; the cache
   * is cleared on `setOrganizationInvite` and `clearOrganizationInvite` so state transitions
   * never leave stale entries behind.
   * @returns all enabled policies for the org, or undefined on fetch error.
   */
  abstract getOrgPoliciesForInvite(invite: OrganizationInvite): Promise<Policy[] | undefined>;

  /**
   * Derives the master-password policy options enforced by an invite's organization. Uses
   * {@link getOrgPoliciesForInvite} internally, so repeat calls for the same invite honor the
   * per-token cache and do not re-fetch.
   * @returns the org's combined MP requirements, or undefined if the policy fetch failed or
   *   the org has no MP policy enabled.
   */
  abstract getMasterPasswordPolicyOptionsForInvite(
    invite: OrganizationInvite,
  ): Promise<MasterPasswordPolicyOptions | undefined>;

  /**
   * Fetches the public status of an open invite link by its code (anonymous endpoint).
   * Returns a discriminated {@link OpenOrgInviteStatusResult} — `ok` with the status
   * payload on success, or one of the classified failure kinds (`not-found`,
   * `plan-not-supported`) matching the server's known error surfaces. Unclassified
   * failures (network / 5xx / non-`ErrorResponse` throws) return `unexpected` with a
   * best-effort message.
   */
  abstract getOpenOrgInviteStatus(code: string): Promise<OpenOrgInviteStatusResult>;

  /**
   * Validates whether an email's domain is permitted by an open invite link's
   * `AllowedDomains` configuration. Pre-auth UX check consumed by `LoginComponent`
   * and `RegistrationStartComponent`; server-side enforcement runs at accept time
   * regardless.
   * @returns true if the email's domain is allowed, false if not.
   */
  abstract validateOpenOrgInviteEmailDomain(code: string, email: string): Promise<boolean>;
}
