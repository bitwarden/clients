import { combineLatest, firstValueFrom, map, Observable } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import {
  OrganizationUserAcceptInitRequest,
  OrganizationUserAcceptRequest,
  OrganizationUserApiService,
} from "@bitwarden/admin-console/common";
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { KeyService } from "@bitwarden/key-management";
// @bitwarden/organization-invite-link imports back from @bitwarden/common (BaseResponse,
// ApiService, etc.), so this is a circular dependency in the static import graph. It
// resolves at runtime because both libraries reach each other only through abstractions
// that are bound at DI time. Acknowledged here per the same pattern used for the AC API
// service imports above.
import {
  OrganizationInviteLinkAcceptRequest,
  OrganizationInviteLinkApiService,
  OrganizationInviteLinkValidateEmailDomainRequest,
} from "@bitwarden/organization-invite-link";
import { UserId } from "@bitwarden/user-core";

import { ApiService } from "../../../../abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "../../../../admin-console/abstractions/organization/organization-api.service.abstraction";
import { PolicyApiServiceAbstraction } from "../../../../admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyService } from "../../../../admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "../../../../admin-console/enums";
import { MasterPasswordPolicyOptions } from "../../../../admin-console/models/domain/master-password-policy-options";
import { Policy } from "../../../../admin-console/models/domain/policy";
import { OrganizationKeysRequest } from "../../../../admin-console/models/request/organization-keys.request";
import { EncryptService } from "../../../../key-management/crypto/abstractions/encrypt.service";
import { ErrorResponse } from "../../../../models/response/error.response";
import { I18nService } from "../../../../platform/abstractions/i18n.service";
import { LogService } from "../../../../platform/abstractions/log.service";
import { Utils } from "../../../../platform/misc/utils";
import { GlobalState, GlobalStateProvider } from "../../../../platform/state";
import { OrgKey } from "../../../../types/key";
import { AuthService } from "../../../abstractions/auth.service";
import { OrgInviteKind } from "../../enums/org-invite-kind.enum";
import { DirectOrganizationInvite } from "../../models/direct-organization-invite";
import { OpenOrganizationInvite } from "../../models/open-organization-invite";
import { AcceptOpenOrgInviteResult } from "../../types/accept-open-org-invite-result.type";
import { OpenOrgInviteStatusResult } from "../../types/open-org-invite-status-result.type";
import {
  OpenOrgInviteStatus,
  OpenOrgInviteSsoConfig,
} from "../../types/open-org-invite-status.type";
import { OrganizationInvite } from "../../types/organization-invite.type";
import { OrganizationInviteService } from "../organization-invite.service";

import { DIRECT_ORGANIZATION_INVITE, OPEN_ORGANIZATION_INVITE } from "./organization-invite.state";

export class DefaultOrganizationInviteService implements OrganizationInviteService {
  private directInviteState: GlobalState<DirectOrganizationInvite | null>;
  private openInviteState: GlobalState<OpenOrganizationInvite | null>;
  /**
   * Merged stream of the two variant-specific state keys. Mutual exclusion is enforced
   * by {@link setOrganizationInvite} so at most one of the two is non-null; the merge
   * prefers direct, then open.
   */
  readonly activeInvite$: Observable<OrganizationInvite | null>;
  // In-memory dedup of policy lookups across one invite ceremony. The same invite
  // can be checked from login, registration, and accept in a single session;
  // keyed by invite token, cleared whenever a stored invite is set or cleared
  // so a transition can't leak stale entries.
  private policyCache = new Map<string, Policy[]>();

  constructor(
    private readonly apiService: ApiService,
    private readonly authService: AuthService,
    private readonly keyService: KeyService,
    private readonly encryptService: EncryptService,
    private readonly policyApiService: PolicyApiServiceAbstraction,
    private readonly policyService: PolicyService,
    private readonly logService: LogService,
    private readonly organizationApiService: OrganizationApiServiceAbstraction,
    private readonly organizationUserApiService: OrganizationUserApiService,
    private readonly organizationInviteLinkApiService: OrganizationInviteLinkApiService,
    private readonly i18nService: I18nService,
    private readonly globalStateProvider: GlobalStateProvider,
  ) {
    this.directInviteState = this.globalStateProvider.get(DIRECT_ORGANIZATION_INVITE);
    this.openInviteState = this.globalStateProvider.get(OPEN_ORGANIZATION_INVITE);
    this.activeInvite$ = combineLatest([
      this.directInviteState.state$,
      this.openInviteState.state$,
    ]).pipe(map(([direct, open]) => direct ?? open));
  }

  async getOrganizationInvite(): Promise<OrganizationInvite | null> {
    return await firstValueFrom(this.activeInvite$);
  }

  /**
   * Writes the invite to the state key matching its `kind` and clears the opposite key,
   * enforcing the "at most one stashed invite" mutual-exclusion invariant.
   */
  async setOrganizationInvite(invite: OrganizationInvite): Promise<void> {
    switch (invite.kind) {
      case OrgInviteKind.Direct:
        await this.directInviteState.update(() => invite);
        await this.openInviteState.update(() => null);
        break;
      case OrgInviteKind.Open:
        await this.openInviteState.update(() => invite);
        await this.directInviteState.update(() => null);
        break;
    }
    this.policyCache.clear();
  }

  /** Clears both invite keys defensively. Open-only callers should use {@link clearOpenOrgInvite}. */
  async clearOrganizationInvite(): Promise<void> {
    await this.directInviteState.update(() => null);
    await this.openInviteState.update(() => null);
    this.policyCache.clear();
  }

  /**
   * Clears only the open-invite key. Used by callers that should not wipe a concurrent
   * stashed direct invite (e.g. the open-invite landing-page error path).
   */
  async clearOpenOrgInvite(): Promise<void> {
    await this.openInviteState.update(() => null);
    this.policyCache.clear();
  }

  /**
   * Validates and accepts the organization invite if possible.
   *
   * For direct invites: if the org enforces an MP policy and the user hasn't yet
   * passed it, the invite is stashed and the user is logged out so they re-enter
   * through the normal login flow (which validates the MP policy against their
   * current master password). For open invites, the same MP-policy-detour applies,
   * plus a ResetPassword auto-enroll path when the org's policy requires it.
   *
   * @returns true if the invite was accepted; false if it was stashed pending re-auth.
   */
  async validateAndAcceptDirectOrgInvite(
    invite: DirectOrganizationInvite,
    userId: UserId,
  ): Promise<boolean> {
    // Creation of a new org
    if (invite.initOrganization) {
      await this.acceptDirectOrgInviteAndInitOrganization(invite, userId);
      return true;
    }

    // Reached when an already-authenticated user lands on /accept-organization
    // without first passing through the unauthed flow that would have stashed
    // the invite — e.g., copying the accept-invite link out of the email and
    // pasting it into the URL bar of a session that's already signed in. In
    // that case `unauthedHandler` never runs, so `authedHandler` calls into
    // here with no stash present. If the org has an MP policy enabled, we
    // stash the invite and log the user out so they re-enter through the
    // normal flow, where login enforces the MP policy against their current
    // master password.
    if (await this.directInviteMasterPasswordPolicyCheckRequired(invite)) {
      await this.setOrganizationInvite(invite);
      this.authService.logOut(() => {
        /* Do nothing */
      });
      return false;
    }

    // We know the user has already logged in and passed a MP policy check
    await this.acceptDirectOrgInvite(invite, userId);
    return true;
  }

  async acceptOpenOrgInvite(
    invite: OpenOrganizationInvite,
    userId: UserId,
  ): Promise<AcceptOpenOrgInviteResult> {
    // MP-policy detour for open invites: if the org requires a compliant MP and the
    // user hasn't been through the detour yet (no matching stash), persist + log out
    // so login can re-check the MP against their current password.
    if (await this.openInviteMasterPasswordPolicyCheckRequired(invite)) {
      await this.setOrganizationInvite(invite);
      this.authService.logOut(() => {
        /* Do nothing */
      });
      return { kind: "stashed-for-mp-policy-detour" };
    }

    try {
      const orgPublicKeyEncryptedUserKey = await this.computeOpenInviteResetPasswordKey(
        invite,
        userId,
      );
      await this.organizationInviteLinkApiService.accept(
        new OrganizationInviteLinkAcceptRequest({
          code: invite.inviteLinkCode,
          resetPasswordKey: orgPublicKeyEncryptedUserKey,
        }),
      );
      await this.apiService.refreshIdentityToken();
      await this.clearOrganizationInvite();
      return { kind: "accepted" };
    } catch (e) {
      return this.classifyAcceptOpenOrgInviteError(e);
    }
  }

  /**
   * Classifies accept-endpoint failures by matching the server's response message against
   * the string constants defined in the server error files under
   * `server/src/Core/AdminConsole/OrganizationFeatures/`:
   *   - `InviteLinks/Errors.cs`
   *   - `OrganizationUsers/AcceptMembership/Errors.cs`
   *   - `OrganizationUsers/AutoConfirmUser/Errors.cs`
   *   - `Policies/PolicyRequirements/Errors/SingleOrganizationPolicyErrors.cs`
   *
   * String matching is the only client-side discriminator today — the server does not
   * emit a stable error code on these responses. When a message changes on the server
   * without a matching update here, the case falls through to `unexpected` and the
   * server's raw text is surfaced to the user; the flow degrades gracefully rather
   * than breaking. Spec cases mirror these strings so a copy change fails tests.
   */
  private classifyAcceptOpenOrgInviteError(e: unknown): AcceptOpenOrgInviteResult {
    if (!(e instanceof ErrorResponse)) {
      return { kind: "unexpected", errorMessage: this.extractErrorMessage(e) };
    }
    if (e.statusCode === 404) {
      return { kind: "link-not-found" };
    }
    if (e.statusCode !== 400) {
      return { kind: "unexpected", errorMessage: this.extractErrorMessage(e) };
    }

    const message = e.getSingleMessage() ?? "";
    if (message === "Your organization's plan does not support invite links.") {
      return { kind: "plan-not-supported" };
    }
    if (message === "Your email domain is not allowed to join this organization.") {
      return { kind: "email-domain-not-allowed" };
    }
    if (message === "You are already a member of this organization.") {
      return { kind: "already-member" };
    }
    if (message === "Your organization access has been revoked.") {
      return { kind: "org-access-revoked" };
    }
    if (message === "This organization has no available seats.") {
      return { kind: "no-seats" };
    }
    // SeatAddFailed reads the same to the user as OrganizationHasNoAvailableSeats — both
    // mean "seat unavailable"; the distinction is billing plumbing the user can't act on.
    if (message.startsWith("Unable to join this organization right now.")) {
      return { kind: "no-seats" };
    }
    if (
      message ===
      "You cannot join this organization until you enable two-step login on your user account."
    ) {
      return { kind: "two-factor-required" };
    }
    // Folds UserIsAMemberOfAnotherOrganization + UserIsAMemberOfAnOrganizationThatHasSingleOrgPolicy —
    // both single-org policy variants share the same user-facing meaning.
    if (message.startsWith("Member cannot join the organization")) {
      return { kind: "single-org-policy-violation" };
    }
    // Folds UserCannotBelongToAnotherOrganization + OtherOrganizationDoesNotAllowOtherMembership —
    // both auto-confirm policy variants share the same user-facing meaning.
    if (message.startsWith("Cannot confirm this member")) {
      return { kind: "auto-confirm-policy-violation" };
    }
    if (message === "Provider users cannot join organizations via invite link.") {
      return { kind: "provider-user" };
    }
    // AutoConfirm's provider variant; same user-facing meaning as the direct provider block above.
    if (
      message.startsWith(
        "An organization the user is a part of has enabled Automatic User Confirmation",
      )
    ) {
      return { kind: "provider-user" };
    }
    if (message === "You can only be an admin of one free organization.") {
      return { kind: "free-admin-limit" };
    }
    if (message === "Master Password reset is required, but not provided.") {
      return { kind: "reset-password-key-required" };
    }
    return { kind: "unexpected", errorMessage: message };
  }

  async getOrgPoliciesForInvite(invite: OrganizationInvite): Promise<Policy[] | undefined> {
    const cacheKey = invite.kind === OrgInviteKind.Direct ? invite.token : invite.inviteLinkCode;
    const cached = this.policyCache.get(cacheKey);
    if (cached != null) {
      return cached;
    }

    try {
      const policies =
        invite.kind === OrgInviteKind.Direct
          ? await this.policyApiService.getPoliciesByToken(
              invite.organizationId,
              invite.token,
              invite.email,
              invite.organizationUserId,
            )
          : await this.policyApiService.getPoliciesByInviteLinkCode(invite.inviteLinkCode);
      if (policies != null) {
        this.policyCache.set(cacheKey, policies);
      }
      return policies;
    } catch (e) {
      this.logService.error(e);
      return undefined;
    }
  }

  async getOpenOrgInviteStatus(code: string): Promise<OpenOrgInviteStatusResult> {
    try {
      const response = await this.organizationInviteLinkApiService.getStatus(code);
      // TODO: PM-39815 — server is moving the "plan doesn't support invite links"
      // signal from a 400 InviteLinkNotAvailable error to a boolean field (e.g.,
      // LinksEnabled) on the successful status payload. When that lands:
      //   1. Add the field to OrganizationInviteLinkStatusResponseModel and
      //      OpenOrgInviteStatus.
      //   2. Return `{ kind: "plan-not-supported" }` from here when the field is
      //      false, before constructing the `ok` result below.
      //   3. Remove the 400 branch in the catch below (a stray 400 then falls
      //      through to `unexpected`, which is the desired behavior).
      // Consumer result contract is unchanged.
      const sso: OpenOrgInviteSsoConfig | null =
        response.sso == null
          ? null
          : { orgSsoId: response.sso.orgSsoId, required: response.sso.required };
      const status: OpenOrgInviteStatus = {
        organizationId: response.organizationId,
        organizationName: response.organizationName,
        seatsAvailable: response.seatsAvailable,
        sso,
      };
      return { kind: "ok", status };
    } catch (e) {
      if (e instanceof ErrorResponse && e.statusCode === 404) {
        return { kind: "not-found" };
      }
      if (e instanceof ErrorResponse && e.statusCode === 400) {
        return { kind: "plan-not-supported" };
      }
      return { kind: "unexpected", errorMessage: this.extractErrorMessage(e) };
    }
  }

  /**
   * Best-effort message extractor for the `unexpected` kind on result-typed methods.
   * `ErrorResponse.getSingleMessage()` surfaces the most user-facing string (validation
   * errors first, then top-level `Message`); other `Error`s expose `.message`; unknown
   * throws fall back to `String(e)`. Shared across result-typed methods so the fallback
   * behavior stays consistent.
   */
  private extractErrorMessage(e: unknown): string {
    if (e instanceof ErrorResponse) {
      return e.getSingleMessage();
    }
    if (e instanceof Error) {
      return e.message;
    }
    return String(e);
  }

  /**
   * Validates whether an email's domain is permitted by an open invite link's
   * `AllowedDomains` configuration. Consumed by `LoginComponent` /
   * `RegistrationStartComponent` as a pre-auth UX check; server-side enforcement
   * runs at accept time regardless.
   */
  async validateOpenOrgInviteEmailDomain(code: string, email: string): Promise<boolean> {
    const response = await this.organizationInviteLinkApiService.validateEmailDomain(
      new OrganizationInviteLinkValidateEmailDomainRequest({ code, email }),
    );
    return response.isAllowed;
  }

  async getMasterPasswordPolicyOptionsForInvite(
    invite: OrganizationInvite,
  ): Promise<MasterPasswordPolicyOptions | undefined> {
    const policies = await this.getOrgPoliciesForInvite(invite);
    if (policies == null) {
      return undefined;
    }
    return this.policyService.combinePoliciesIntoMasterPasswordPolicyOptions(policies);
  }

  private async acceptDirectOrgInviteAndInitOrganization(
    invite: DirectOrganizationInvite,
    userId: UserId,
  ): Promise<void> {
    await this.prepareDirectOrgInviteAcceptAndInitRequest(invite, userId).then((request) =>
      this.organizationUserApiService.postOrganizationUserAcceptInit(
        invite.organizationId,
        invite.organizationUserId,
        request,
      ),
    );
    await this.apiService.refreshIdentityToken();
    await this.clearOrganizationInvite();
  }

  private async prepareDirectOrgInviteAcceptAndInitRequest(
    invite: DirectOrganizationInvite,
    userId: UserId,
  ): Promise<OrganizationUserAcceptInitRequest> {
    const [encryptedOrgKey, orgKey] = await this.keyService.makeOrgKey<OrgKey>(userId);
    const [orgPublicKey, encryptedOrgPrivateKey] = await this.keyService.makeKeyPair(orgKey);
    const collection = await this.encryptService.encryptString(
      this.i18nService.t("defaultCollection"),
      orgKey,
    );

    if (
      encryptedOrgKey.encryptedString == null ||
      encryptedOrgPrivateKey.encryptedString == null ||
      collection.encryptedString == null
    ) {
      throw new Error("Failed to encrypt organization init data.");
    }

    return new OrganizationUserAcceptInitRequest(
      invite.token,
      encryptedOrgKey.encryptedString,
      new OrganizationKeysRequest(orgPublicKey, encryptedOrgPrivateKey.encryptedString),
      collection.encryptedString,
    );
  }

  private async acceptDirectOrgInvite(
    invite: DirectOrganizationInvite,
    userId: UserId,
  ): Promise<void> {
    await this.prepareDirectOrgInviteAcceptRequest(invite, userId).then((request) =>
      this.organizationUserApiService.postOrganizationUserAccept(
        invite.organizationId,
        invite.organizationUserId,
        request,
      ),
    );

    await this.apiService.refreshIdentityToken();
    await this.clearOrganizationInvite();
  }

  private async prepareDirectOrgInviteAcceptRequest(
    invite: DirectOrganizationInvite,
    userId: UserId,
  ): Promise<OrganizationUserAcceptRequest> {
    const request = new OrganizationUserAcceptRequest();
    request.token = invite.token;

    if (await this.directInviteRequiresResetPasswordAutoEnroll(invite)) {
      const orgKeysResponse = await this.organizationApiService.getKeys(invite.organizationId);

      if (orgKeysResponse == null) {
        throw new Error(this.i18nService.t("resetPasswordOrgKeysError"));
      }

      const orgPublicKey = Utils.fromB64ToArray(orgKeysResponse.publicKey);

      const userKey = await firstValueFrom(this.keyService.userKey$(userId));
      if (userKey == null) {
        throw new Error("User key is required to enroll in password reset.");
      }

      const orgPublicKeyEncryptedUserKey = await this.encryptService.encapsulateKeyUnsigned(
        userKey,
        orgPublicKey,
      );
      if (orgPublicKeyEncryptedUserKey.encryptedString == null) {
        throw new Error("Failed to encrypt user key for password reset enrollment.");
      }

      request.resetPasswordKey = orgPublicKeyEncryptedUserKey.encryptedString;
    }
    return request;
  }

  private async directInviteRequiresResetPasswordAutoEnroll(
    directOrgInvite: DirectOrganizationInvite,
  ): Promise<boolean> {
    const policies = await this.getOrgPoliciesForInvite(directOrgInvite);

    if (policies == null || policies.length === 0) {
      return false;
    }

    const result = this.policyService.getResetPasswordPolicyOptions(
      policies,
      directOrgInvite.organizationId,
    );
    // Return true if policy enabled and auto-enroll enabled
    return result[1] && result[0].autoEnrollEnabled;
  }

  private async directInviteMasterPasswordPolicyCheckRequired(
    invite: DirectOrganizationInvite,
  ): Promise<boolean> {
    const policies = await this.getOrgPoliciesForInvite(invite);

    if (policies == null || policies.length === 0) {
      return false;
    }
    const hasMasterPasswordPolicy = policies.some(
      (p) => p.type === PolicyType.MasterPassword && p.enabled,
    );

    let storedInvite = await this.getOrganizationInvite();
    if (
      storedInvite != null &&
      storedInvite.kind === OrgInviteKind.Direct &&
      storedInvite.email !== invite.email
    ) {
      // clear stored invites if the email doesn't match
      await this.clearOrganizationInvite();
      storedInvite = null;
    }
    // if we don't have an org invite stored, we know the user hasn't been redirected yet to check the MP policy
    const hasNotCheckedMasterPasswordYet = storedInvite == null;
    return hasMasterPasswordPolicy && hasNotCheckedMasterPasswordYet;
  }

  private async openInviteMasterPasswordPolicyCheckRequired(
    invite: OpenOrganizationInvite,
  ): Promise<boolean> {
    const policies = await this.getOrgPoliciesForInvite(invite);
    if (policies == null || policies.length === 0) {
      return false;
    }
    const hasMasterPasswordPolicy = policies.some(
      (p) => p.type === PolicyType.MasterPassword && p.enabled,
    );

    // Open invites carry no user identity, so there's no email-mismatch fork. The
    // "have we been through the detour" signal is just whether a matching open-invite
    // stash exists. If the stash holds a different open invite (different code), clear
    // it so this invite gets fresh MP-policy treatment.
    let storedInvite = await this.getOrganizationInvite();
    if (
      storedInvite != null &&
      storedInvite.kind === OrgInviteKind.Open &&
      storedInvite.inviteLinkCode !== invite.inviteLinkCode
    ) {
      await this.clearOrganizationInvite();
      storedInvite = null;
    }
    const hasNotCheckedMasterPasswordYet = storedInvite == null;
    return hasMasterPasswordPolicy && hasNotCheckedMasterPasswordYet;
  }

  /**
   * Encrypts the user key with the org's public key so the server can auto-enroll the
   * user in the org's account-recovery flow as part of accepting an
   * open invite.
   *
   * Returns undefined when the org's account-recovery policy doesn't auto-enroll
   * accepting members. Callers set `resetPasswordKey` on the accept request to the
   * returned value.
   */
  private async computeOpenInviteResetPasswordKey(
    invite: OpenOrganizationInvite,
    userId: UserId,
  ): Promise<string | undefined> {
    const policies = await this.getOrgPoliciesForInvite(invite);
    if (policies == null || policies.length === 0) {
      return undefined;
    }

    const [resetPasswordOptions, enabled] = this.policyService.getResetPasswordPolicyOptions(
      policies,
      invite.organizationId,
    );
    if (!enabled || !resetPasswordOptions.autoEnrollEnabled) {
      return undefined;
    }

    const orgKeysResponse = await this.organizationApiService.getKeys(invite.organizationId);
    if (orgKeysResponse == null) {
      throw new Error(this.i18nService.t("resetPasswordOrgKeysError"));
    }
    const orgPublicKey = Utils.fromB64ToArray(orgKeysResponse.publicKey);

    const userKey = await firstValueFrom(this.keyService.userKey$(userId));
    if (userKey == null) {
      throw new Error("User key is required to enroll in password reset.");
    }

    const orgPublicKeyEncryptedUserKey = await this.encryptService.encapsulateKeyUnsigned(
      userKey,
      orgPublicKey,
    );
    if (orgPublicKeyEncryptedUserKey.encryptedString == null) {
      throw new Error("Failed to encrypt user key for password reset enrollment.");
    }
    return orgPublicKeyEncryptedUserKey.encryptedString;
  }
}
