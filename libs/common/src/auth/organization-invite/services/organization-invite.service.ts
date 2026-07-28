import { Observable } from "rxjs";

import { UserId } from "@bitwarden/user-core";

import { MasterPasswordPolicyOptions } from "../../../admin-console/models/domain/master-password-policy-options";
import { Policy } from "../../../admin-console/models/domain/policy";
import { DirectOrganizationInvite } from "../models/direct-organization-invite";
import { OpenOrganizationInvite, OpenOrgInviteUrlParams } from "../models/open-organization-invite";
import { AcceptOpenOrgInviteResult } from "../types/accept-open-org-invite-result.type";
import { OpenOrgInviteStatusResult } from "../types/open-org-invite-status-result.type";
import { OrganizationInvite } from "../types/organization-invite.type";
import { UnsealOpenOrgInviteResult } from "../types/unseal-open-org-invite-result.type";

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
   * Accepts a direct organization invite for the active user, or stashes it and logs out
   * if the user must first satisfy the org's master-password policy. The stashed invite
   * is consumed when the user returns after re-authenticating with a compliant master
   * password.
   * @returns true if the invite was accepted; false if it was stashed pending re-auth.
   */
  abstract validateAndAcceptDirectOrgInvite(
    invite: DirectOrganizationInvite,
    userId: UserId,
  ): Promise<boolean>;

  /**
   * Accepts an open organization invite for the active user. Returns a discriminated
   * {@link AcceptOpenOrgInviteResult} classifying the outcome — success, MP-policy detour,
   * or one of the server's known rejection modes. Unclassified failures (network, 5xx,
   * unrecognized 400 messages, non-`ErrorResponse` throws) surface as `unexpected` with
   * a best-effort message string so the caller can render something meaningful.
   */
  abstract acceptOpenOrgInvite(
    invite: OpenOrganizationInvite,
    userId: UserId,
  ): Promise<AcceptOpenOrgInviteResult>;

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
   * Fetches the public status of an open invite link (anonymous endpoint), scoped to
   * `(organizationId, code)`. Returns a discriminated {@link OpenOrgInviteStatusResult} —
   * `ok` with the status payload on success, or one of the classified failure kinds
   * (`not-found`, `plan-not-supported`) matching the server's known error surfaces.
   * Unclassified failures (network / 5xx / non-`ErrorResponse` throws) return `unexpected`
   * with a best-effort message.
   */
  abstract getOpenOrgInviteStatus(
    organizationId: string,
    code: string,
  ): Promise<OpenOrgInviteStatusResult>;

  /**
   * Validates whether an email's domain is permitted by an open invite link's
   * `AllowedDomains` configuration, scoped to `(organizationId, code)` for parity with the
   * status / accept endpoints. Pre-auth UX check consumed by `LoginComponent` and
   * `RegistrationStartComponent`; server-side enforcement runs at accept time regardless.
   * @returns true if the email's domain is allowed, false if not.
   */
  abstract validateOpenOrgInviteEmailDomain(
    organizationId: string,
    code: string,
    email: string,
  ): Promise<boolean>;

  /**
   * Returns the base64-encoded `HighEntropySecret` previously paired with a sealed open-invite
   * blob for the given email, or `null` if none is stored (never registered on this browser
   * origin, cleared after a successful accept, or swept by the TTL). The secret is the
   * client-only half of the two-halves the SDK's `unseal_open_org_invite_data` needs.
   */
  abstract getSealedOpenOrgInviteSecret(email: string): Promise<string | null>;

  /**
   * Seals an open-org-invite context for the registration-crossing flow: hands the URL-params
   * triple to the SDK's `seal_open_org_invite_data`, stores the returned `HighEntropySecret`
   * paired with `email` (so a later `unsealOpenOrgInvite` can recover it), and returns the
   * sealed blob for the caller to attach to the verification-email request. Returns `null`
   * when {@link FeatureFlag.GenerateInviteLink} is off so callers can no-op without a flag
   * check of their own.
   */
  abstract sealOpenOrgInvite(email: string, invite: OpenOrgInviteUrlParams): Promise<string | null>;

  /**
   * Unseals a previously-sealed open-org-invite blob using the `HighEntropySecret` stored for
   * `email`. Returns a discriminated {@link UnsealOpenOrgInviteResult} — `ok` with the invite
   * on success, `secret-miss` when no secret is stored, `crypto-failure` when the SDK reports
   * a `RegistrationError.Crypto`, or `unexpected` with a best-effort message for anything else.
   */
  abstract unsealOpenOrgInvite(
    email: string,
    sealedData: string,
  ): Promise<UnsealOpenOrgInviteResult>;

  /**
   * Removes the sealed-open-org-invite secret entry for the given email. Called on
   * accept-success, on any accept-failure branch that has a stored secret to invalidate, and
   * on unseal-failure (tampered blob / wrong secret). Safe to call when no entry exists.
   */
  abstract clearSealedOpenOrgInviteSecret(email: string): Promise<void>;

  /**
   * Sweeps the entire sealed-open-org-invite secret record, removing entries whose
   * `createdAtMs` is older than the TTL. Web-only in practice — the underlying state is
   * `disk-local` on web and unused elsewhere. Called from the web app's `APP_INITIALIZER`
   * chain on every boot; a strict `>` boundary comparison prevents jitter-induced churn.
   */
  abstract clearExpiredSealedOpenOrgInviteSecrets(): Promise<void>;
}
