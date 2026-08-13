import { Observable } from "rxjs";

import { UserId } from "@bitwarden/user-core";

import { MasterPasswordPolicyOptions } from "../../../admin-console/models/domain/master-password-policy-options";
import { Policy } from "../../../admin-console/models/domain/policy";
import { DirectOrganizationInvite } from "../models/direct-organization-invite";
import { OpenOrganizationInvite, OpenOrgInviteLinkData } from "../models/open-organization-invite";
import { OpenOrgInviteAcceptResult } from "../types/open-org-invite-accept-result.type";
import { OpenOrgInviteStatusResult } from "../types/open-org-invite-status-result.type";
import { OpenOrgInviteUnsealResult } from "../types/open-org-invite-unseal-result.type";
import { OpenOrgInviteValidateEmailDomainResult } from "../types/open-org-invite-validate-email-domain-result.type";
import { OrganizationInvite } from "../types/organization-invite.type";

/**
 * Owns the in-flight organization invite: persisted across login/register/MP-policy
 * detours, then consumed when the user accepts (or stashed and reloaded if an MP
 * policy check redirects them through re-auth first).
 */
export abstract class OrganizationInviteService {
  /**
   * Emits the currently stored organization invite, preferring direct over open. At most
   * one variant is non-null at a time per the mutual-exclusion invariant enforced by
   * {@link setOrganizationInvite}.
   */
  abstract activeInvite$: Observable<OrganizationInvite | null>;

  /**
   * Returns the currently stored organization invite (direct or open).
   */
  abstract getOrganizationInvite(): Promise<OrganizationInvite | null>;

  /**
   * Returns the currently stored open org invite, or `null` when no open invite is
   * stashed (including when a direct invite is stashed). Use this over
   * {@link getOrganizationInvite} at call sites that only care about the open variant so
   * the reader doesn't need a `kind` discriminator at every consumer.
   */
  abstract getOpenOrgInvite(): Promise<OpenOrganizationInvite | null>;

  /**
   * Stores a new organization invite. The opposite variant, if any, is cleared (mutual
   * exclusion). Callers that want to remove the stored invite should use
   * {@link clearOrganizationInvite} or {@link clearOpenOrgInvite}.
   */
  abstract setOrganizationInvite(invite: OrganizationInvite): Promise<void>;

  /**
   * Clears any stored invite (direct or open). Use this for general "I'm done with any
   * pending invite" cleanup. For open-only cleanup that must not affect a
   * direct invite, use {@link clearOpenOrgInvite}.
   */
  abstract clearOrganizationInvite(): Promise<void>;

  /**
   * Clears only the open-org-invite state key. Used by the open-org-invite landing-page error
   * path so a malformed open-org-invite URL cannot wipe a concurrent stashed direct invite.
   */
  abstract clearOpenOrgInvite(): Promise<void>;

  /**
   * Accepts a direct organization invite for the active user, or stashes it and logs out
   * if the user must first satisfy the org's master-password policy. The stashed invite
   * is consumed when the user returns after re-authenticating with a compliant master
   * password.
   *
   * `postAuthRedirectUrl` is the URL the deep-link guard should replay after the user
   * re-authenticates. Callers pass their current page URL (typically the accept-org
   * route with the invite's query params) so the guard sends the user back to the same
   * page. Ignored on clients without a deep-link redirect service.
   *
   * @returns true if the invite was accepted; false if it was stashed pending re-auth.
   */
  abstract validateAndAcceptDirectOrgInvite(
    invite: DirectOrganizationInvite,
    userId: UserId,
    postAuthRedirectUrl: string,
  ): Promise<boolean>;

  /**
   * Accepts an open organization invite for the active user. Returns a discriminated
   * {@link OpenOrgInviteAcceptResult} classifying the outcome — success, MP-policy detour,
   * or one of the server's known rejection modes. Unclassified failures (network, 5xx,
   * unrecognized 400 messages, non-`ErrorResponse` throws) surface as `unexpected` with
   * a best-effort message string so the caller can render something meaningful.
   *
   * `postAuthRedirectUrl` is the URL the deep-link guard should replay after the user
   * re-authenticates on the MP-policy detour. Callers pass their current page URL so the
   * guard sends the user back to the same page. Ignored on clients without a deep-link
   * redirect service.
   */
  abstract acceptOpenOrgInvite(
    invite: OpenOrganizationInvite,
    userId: UserId,
    postAuthRedirectUrl: string,
  ): Promise<OpenOrgInviteAcceptResult>;

  /**
   * Fetches all enabled policies for the inviting organization, authenticated via the invite token
   * (no user session required). Callers filter by `PolicyType` for their needs (e.g. `MasterPassword`,
   * `ResetPassword`). Repeat calls for the same invite are memoized.
   * @returns all enabled policies for the org, or undefined on fetch error.
   */
  abstract getOrgPoliciesForInvite(invite: OrganizationInvite): Promise<Policy[] | undefined>;

  /**
   * Derives the master-password policy options enforced by an invite's organization.
   * Repeat calls for the same invite are memoized.
   * @returns the org's combined MP requirements, or undefined if the policy fetch failed or
   *   the org has no MP policy enabled.
   */
  abstract getMasterPasswordPolicyOptionsForInvite(
    invite: OrganizationInvite,
  ): Promise<MasterPasswordPolicyOptions | undefined>;

  /**
   * Fetches the public status of an open org invite link (anonymous endpoint), scoped to
   * `(organizationId, code)`. Returns a discriminated {@link OpenOrgInviteStatusResult} —
   * `ok` with the status payload on success, or one of the classified failure kinds
   * (`not-found`, `plan-not-supported`, `no-seats`) matching the server's known error
   * surfaces. Unclassified failures (network / 5xx / non-`ErrorResponse` throws) return
   * `unexpected` with a best-effort message.
   *
   * Server-authoritative terminal kinds (`not-found`, `plan-not-supported`, `no-seats`)
   * clear the stashed open-org invite — same invariant as {@link acceptOpenOrgInvite}.
   * The transient `unexpected` kind preserves the stash so a retry after a network/5xx
   * blip doesn't re-trigger the MP-policy detour on orgs whose invite the user has
   * already validated.
   */
  abstract getOpenOrgInviteStatus(
    organizationId: string,
    code: string,
  ): Promise<OpenOrgInviteStatusResult>;

  /**
   * Validates whether an email's domain is permitted by an open org invite link's
   * `AllowedDomains` configuration, scoped to `(organizationId, code)` for parity with the
   * status / accept endpoints. Pre-auth UX check; server-side enforcement runs at accept
   * time regardless. See {@link OpenOrgInviteValidateEmailDomainResult} for the
   * discriminated outcome kinds.
   */
  abstract validateOpenOrgInviteEmailDomain(
    organizationId: string,
    code: string,
    email: string,
  ): Promise<OpenOrgInviteValidateEmailDomainResult>;

  /**
   * Seals the open-org-invite context (`organizationId`, `inviteLinkCode`, `inviteKey`)
   * against a per-email secret so a later {@link unsealOpenOrgInvite} can recover it, and
   * returns the sealed blob for the caller to attach to the verification-email request.
   * Returns `null` when {@link FeatureFlag.GenerateInviteLink} is off so callers can no-op
   * without a flag check of their own.
   */
  abstract sealOpenOrgInvite(email: string, invite: OpenOrgInviteLinkData): Promise<string | null>;

  /**
   * Unseals a previously-sealed open-org-invite blob using the `HighEntropySecret` stored
   * for `email`. See {@link OpenOrgInviteUnsealResult} for the discriminated outcome kinds.
   */
  abstract unsealOpenOrgInvite(
    email: string,
    sealedData: string,
  ): Promise<OpenOrgInviteUnsealResult>;

  /**
   * Removes the sealed-open-org-invite secret entry for the given email. Call once after
   * {@link unsealOpenOrgInvite} regardless of outcome — the secret is single-use. Safe to
   * call when no entry exists.
   */
  abstract clearSealedOpenOrgInviteSecret(email: string): Promise<void>;

  /**
   * Removes sealed-open-org-invite secret entries whose TTL has elapsed.
   * Safe to call when no entries exist.
   */
  abstract clearExpiredSealedOpenOrgInviteSecrets(): Promise<void>;
}
