import { combineLatest, concatMap, firstValueFrom, map, Observable } from "rxjs";

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
  OrganizationInviteLinkApiService,
  OrganizationInviteLinkValidateEmailDomainRequest,
} from "@bitwarden/organization-invite-link";
import {
  isInviteLinkError,
  isRegistrationError,
  OpenOrgInvite,
  OrganizationId as SdkOrganizationId,
  PasswordManagerClient,
  SealedOpenOrgInvite,
} from "@bitwarden/sdk-internal";
import { UserId } from "@bitwarden/user-core";

import { ApiService } from "../../../../abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "../../../../admin-console/abstractions/organization/organization-api.service.abstraction";
import { PolicyApiServiceAbstraction } from "../../../../admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyService } from "../../../../admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "../../../../admin-console/enums";
import { MasterPasswordPolicyOptions } from "../../../../admin-console/models/domain/master-password-policy-options";
import { Policy } from "../../../../admin-console/models/domain/policy";
import { OrganizationKeysRequest } from "../../../../admin-console/models/request/organization-keys.request";
import { FeatureFlag } from "../../../../enums/feature-flag.enum";
import { EncryptService } from "../../../../key-management/crypto/abstractions/encrypt.service";
import { ErrorResponse } from "../../../../models/response/error.response";
import { ConfigService } from "../../../../platform/abstractions/config/config.service";
import { I18nService } from "../../../../platform/abstractions/i18n.service";
import { LogService } from "../../../../platform/abstractions/log.service";
import { asUuid, SdkService } from "../../../../platform/abstractions/sdk/sdk.service";
import { Utils } from "../../../../platform/misc/utils";
import { GlobalState, GlobalStateProvider } from "../../../../platform/state";
import { OrgKey } from "../../../../types/key";
import { AuthService } from "../../../abstractions/auth.service";
import { OrgInviteKind } from "../../enums/org-invite-kind.enum";
import { DirectOrganizationInvite } from "../../models/direct-organization-invite";
import {
  OpenOrganizationInvite,
  OpenOrgInviteUrlParams,
} from "../../models/open-organization-invite";
import { AcceptOpenOrgInviteResult } from "../../types/accept-open-org-invite-result.type";
import { OpenOrgInviteStatusResult } from "../../types/open-org-invite-status-result.type";
import { OpenOrgInviteSsoConfig } from "../../types/open-org-invite-status.type";
import { OrganizationInvite } from "../../types/organization-invite.type";
import { UnsealOpenOrgInviteResult } from "../../types/unseal-open-org-invite-result.type";
import { OrganizationInviteService } from "../organization-invite.service";

import { DIRECT_ORGANIZATION_INVITE, OPEN_ORGANIZATION_INVITE } from "./organization-invite.state";
import {
  EMAIL_SEALED_OPEN_ORG_INVITE_SECRET_RECORD_DISK_LOCAL,
  SEALED_OPEN_ORG_INVITE_SECRET_TTL_MS,
  SealedOpenOrgInviteSecretState,
} from "./sealed-open-org-invite-secret.state";

export class DefaultOrganizationInviteService implements OrganizationInviteService {
  private directInviteState: GlobalState<DirectOrganizationInvite | null>;
  private openInviteState: GlobalState<OpenOrganizationInvite | null>;
  /**
   * Record of `{ email → { highEntropySecret, createdAtMs } }` for in-flight
   * open-organization-invite registration crossings. Web-only (`disk-local`); pruned by
   * {@link clearExpiredSealedOpenOrgInviteSecrets} on APP_INITIALIZER boot.
   */
  private sealedOpenOrgInviteSecretState: GlobalState<Record<
    string,
    SealedOpenOrgInviteSecretState
  > | null>;
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
    private readonly sdkService: SdkService,
    private readonly configService: ConfigService,
  ) {
    this.directInviteState = this.globalStateProvider.get(DIRECT_ORGANIZATION_INVITE);
    this.openInviteState = this.globalStateProvider.get(OPEN_ORGANIZATION_INVITE);
    this.sealedOpenOrgInviteSecretState = this.globalStateProvider.get(
      EMAIL_SEALED_OPEN_ORG_INVITE_SECRET_RECORD_DISK_LOCAL,
    );
    this.activeInvite$ = combineLatest([
      this.directInviteState.state$,
      this.openInviteState.state$,
    ]).pipe(map(([direct, open]) => direct ?? open));
  }

  async getOrganizationInvite(): Promise<OrganizationInvite | null> {
    return await firstValueFrom(this.activeInvite$);
  }

  /**
   * Kind-specific reads of the two segregated state keys. Used internally by paths
   * (e.g. the MP-policy detour checks) that must not treat a stash of the opposite
   * kind as belonging to the invite in hand. External callers should keep using
   * {@link getOrganizationInvite} for the merged view.
   */
  private async getDirectOrgInvite(): Promise<DirectOrganizationInvite | null> {
    return await firstValueFrom(this.directInviteState.state$);
  }

  private async getOpenOrgInvite(): Promise<OpenOrganizationInvite | null> {
    return await firstValueFrom(this.openInviteState.state$);
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

    const enrollIntoAccountRecovery = await this.openInviteRequiresResetPasswordAutoEnroll(invite);
    const vfo1Enabled = await this.configService.getFeatureFlag(FeatureFlag.VFO1Foundation);
    const defaultCollectionName = this.i18nService.t(
      vfo1Enabled ? "defaultSharedFolder" : "defaultCollection",
    );

    try {
      await firstValueFrom(
        this.sdkService.userClient$(userId).pipe(
          concatMap(async (sdk) => {
            using ref = sdk.take();
            await ref.value
              .invite_link()
              .accept_and_optionally_confirm(
                asUuid<SdkOrganizationId>(invite.organizationId),
                invite.inviteLinkCode,
                invite.inviteKey,
                defaultCollectionName,
                enrollIntoAccountRecovery,
              );
          }),
        ),
      );
      await this.apiService.refreshIdentityToken();
      await this.clearOrganizationInvite();
      return { kind: "accepted" };
    } catch (e) {
      return this.classifyAcceptOpenOrgInviteError(e);
    }
  }

  /**
   * The SDK wraps HTTP failures as `variant: "Api"` with a display string of the form
   * `Received error message from server: [{status}] {server-message}` (from
   * `bitwarden-core::ApiError::Response`). Unwrap once, delegate to
   * {@link classifyServerAcceptError}; unrecognized status/message falls through to
   * `unexpected` with the raw text. `RecoveryKeyMismatch` gets its own kind because
   * it signals org-key substitution.
   */
  private classifyAcceptOpenOrgInviteError(e: unknown): AcceptOpenOrgInviteResult {
    if (!isInviteLinkError(e)) {
      return { kind: "unexpected", errorMessage: this.extractErrorMessage(e) };
    }
    if (e.variant === "RecoveryKeyMismatch") {
      return { kind: "recovery-key-mismatch" };
    }
    if (e.variant !== "Api") {
      return { kind: "unexpected", errorMessage: e.message };
    }
    // Fragile client-side coupling to `bitwarden-core::ApiError::Response`'s Display
    // format; accepted for MVP. Planned follow-up in next milestones: refactor the SDK to expose a better typed
    // error variant. If the format drifts before then, extraction fails
    // and the caller drops to `unexpected` with the raw string.
    // `[\s\S]` in lieu of the `s` (dotAll) flag, which requires ES2018+.
    const match = e.message.match(/^Received error message from server: \[(\d+)\] ([\s\S]+)$/);
    if (match == null) {
      return { kind: "unexpected", errorMessage: e.message };
    }
    return this.classifyServerAcceptError(Number(match[1]), match[2]);
  }

  private classifyServerAcceptError(
    statusCode: number,
    message: string,
  ): AcceptOpenOrgInviteResult {
    if (statusCode === 404) {
      return { kind: "link-not-found" };
    }
    if (statusCode !== 400) {
      return { kind: "unexpected", errorMessage: message };
    }
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
          : await this.policyApiService.getPoliciesByInviteLinkCode(
              invite.organizationId,
              invite.inviteLinkCode,
            );
      if (policies != null) {
        this.policyCache.set(cacheKey, policies);
      }
      return policies;
    } catch (e) {
      this.logService.error(e);
      return undefined;
    }
  }

  async getOpenOrgInviteStatus(
    organizationId: string,
    code: string,
  ): Promise<OpenOrgInviteStatusResult> {
    try {
      const response = await this.organizationInviteLinkApiService.getStatus(organizationId, code);
      if (!response.linksEnabled) {
        return { kind: "plan-not-supported", organizationName: response.organizationName };
      }
      if (!response.seatsAvailable) {
        return { kind: "no-seats", organizationName: response.organizationName };
      }
      const sso: OpenOrgInviteSsoConfig | null =
        response.sso == null
          ? null
          : { orgSsoId: response.sso.orgSsoId, required: response.sso.required };
      return { kind: "ok", status: { organizationName: response.organizationName, sso } };
    } catch (e) {
      if (e instanceof ErrorResponse && e.statusCode === 404) {
        return { kind: "not-found" };
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
  // TODO: needs product input on error handling. The endpoint can throw (404 when the
  // invite link has been deleted, plus 5xx/transport). Today the throw propagates through
  // LoginComponent.openInviteDomainAllowed / RegistrationStartComponent.openInviteDomainAllowed
  // into continue() / submit() and only the global LoggingErrorHandler catches it — the user
  // sees no toast, no form error, and the button click looks like a silent no-op. Options
  // discussed: (a) fail-open and let the accept-flow's classified error path show
  // "invite not found" post-auth; (b) fail-open + clear open-invite state on a definitive
  // 404 so pre-auth "Joining <org>" hints stop lying; (c) also surface a toast at the
  // domain-check step. Awaiting product's call.
  async validateOpenOrgInviteEmailDomain(
    organizationId: string,
    code: string,
    email: string,
  ): Promise<boolean> {
    const response = await this.organizationInviteLinkApiService.validateEmailDomain(
      new OrganizationInviteLinkValidateEmailDomainRequest({ organizationId, code, email }),
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

  async getSealedOpenOrgInviteSecret(email: string): Promise<string | null> {
    const key = this.normalizeEmailKey(email);
    const record = await firstValueFrom(this.sealedOpenOrgInviteSecretState.state$);
    return record?.[key]?.highEntropySecret ?? null;
  }

  async sealOpenOrgInvite(
    email: string,
    invite: OpenOrgInviteUrlParams, // TODO: figure out different type
  ): Promise<string | null> {
    if (!(await this.configService.getFeatureFlag(FeatureFlag.GenerateInviteLink))) {
      return null;
    }
    const client: PasswordManagerClient = await firstValueFrom(this.sdkService.client$);
    const sealed: SealedOpenOrgInvite = client.auth().registration().seal_open_org_invite_data({
      organizationId: invite.organizationId,
      inviteLinkCode: invite.inviteLinkCode,
      inviteSecret: invite.inviteKey,
    });

    await this.setSealedOpenOrgInviteSecret(email, sealed.highEntropySecret);
    return sealed.sealedData;
  }

  async unsealOpenOrgInvite(email: string, sealedData: string): Promise<UnsealOpenOrgInviteResult> {
    const highEntropySecret = await this.getSealedOpenOrgInviteSecret(email);
    if (highEntropySecret == null) {
      return { kind: "secret-miss" };
    }
    try {
      const client: PasswordManagerClient = await firstValueFrom(this.sdkService.client$);
      const unsealed: OpenOrgInvite = client
        .auth()
        .registration()
        .unseal_open_org_invite_data({ sealedData, highEntropySecret });

      return {
        kind: "ok",
        invite: {
          organizationId: unsealed.organizationId,
          inviteLinkCode: unsealed.inviteLinkCode,
          inviteKey: unsealed.inviteSecret,
        },
      };
    } catch (e) {
      return this.classifyUnsealOpenOrgInviteError(e);
    }
  }

  /**
   * Classifies unseal failures by inspecting the SDK's `RegistrationError` surface.
   * The `Crypto` variant covers both a mismatched paired secret and a tampered blob —
   * both indistinguishable at this layer. Any non-`RegistrationError` throw (WASM
   * boundary error, unrelated runtime exception) falls through to `unexpected` with a
   * best-effort message.
   */
  private classifyUnsealOpenOrgInviteError(e: unknown): UnsealOpenOrgInviteResult {
    if (isRegistrationError(e) && e.variant === "Crypto") {
      return { kind: "crypto-failure" };
    }
    return { kind: "unexpected", errorMessage: this.extractErrorMessage(e) };
  }

  private async setSealedOpenOrgInviteSecret(
    email: string,
    highEntropySecret: string,
  ): Promise<void> {
    const key = this.normalizeEmailKey(email);
    const createdAtMs = Date.now();
    await this.sealedOpenOrgInviteSecretState.update((record) => {
      const next = { ...(record ?? {}) };
      next[key] = { highEntropySecret, createdAtMs };
      return next;
    });
  }

  async clearSealedOpenOrgInviteSecret(email: string): Promise<void> {
    const key = this.normalizeEmailKey(email);
    await this.sealedOpenOrgInviteSecretState.update((record) => {
      if (record == null || !(key in record)) {
        return record;
      }
      const next = { ...record };
      delete next[key];
      return next;
    });
  }

  /**
   * Normalizes an email into the string used as the sealed-secret record key. Applied by
   * every record read/write so the seal call site (which sees the raw form email) and the
   * unseal call site (which sees the server-canonicalized account email) key the same entry.
   */
  private normalizeEmailKey(email: string): string {
    return email.trim().toLowerCase();
  }

  /**
   * Idempotent: returns the same record reference when nothing is expired so the state
   * provider can skip an unnecessary disk-local write. Uses strict `>` so entries at the TTL
   * boundary survive clock jitter.
   */
  async clearExpiredSealedOpenOrgInviteSecrets(): Promise<void> {
    const nowMs = Date.now();
    await this.sealedOpenOrgInviteSecretState.update((record) => {
      if (record == null) {
        return record;
      }
      let anyExpired = false;
      const next: Record<string, SealedOpenOrgInviteSecretState> = {};
      for (const [email, entry] of Object.entries(record)) {
        if (nowMs - entry.createdAtMs > SEALED_OPEN_ORG_INVITE_SECRET_TTL_MS) {
          anyExpired = true;
          continue;
        }
        next[email] = entry;
      }
      return anyExpired ? next : record;
    });
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
    const vfo1Enabled = await this.configService.getFeatureFlag(FeatureFlag.VFO1Foundation);
    const collection = await this.encryptService.encryptString(
      this.i18nService.t(vfo1Enabled ? "defaultSharedFolder" : "defaultCollection"),
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

  /**
   * Whether the org's ResetPassword policy has auto-enroll on. Drives the
   * `enrollIntoAccountRecovery` bool passed to the SDK's
   * `accept_and_optionally_confirm`; when true, the SDK fetches the org public key,
   * verifies its thumbprint against the invite's bound key, and encapsulates the
   * user key to it. Shares its policy fetch with the MP-policy check via the
   * per-invite `policyCache`, so both checks cost one round-trip.
   */
  private async openInviteRequiresResetPasswordAutoEnroll(
    openOrgInvite: OpenOrganizationInvite,
  ): Promise<boolean> {
    const policies = await this.getOrgPoliciesForInvite(openOrgInvite);

    if (policies == null || policies.length === 0) {
      return false;
    }

    const [options, enabled] = this.policyService.getResetPasswordPolicyOptions(
      policies,
      openOrgInvite.organizationId,
    );
    return enabled && options.autoEnrollEnabled;
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

    // Read only the direct-invite stash. A stashed open invite must not count as
    // "policy already checked" for this direct invite — they represent different
    // ceremonies and cannot share a detour breadcrumb.
    let storedInvite = await this.getDirectOrgInvite();
    if (storedInvite != null && storedInvite.email !== invite.email) {
      // Different-email stash is stale for this invite; clear so the detour fires fresh.
      await this.clearOrganizationInvite();
      storedInvite = null;
    }
    // If we don't have an org invite stored, we know the user hasn't been redirected
    // yet to check the MP policy.
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

    // Read only the open-invite stash. A stashed direct invite must not count as
    // "policy already checked" for this open invite. Open invites carry no user
    // identity, so the same-kind mismatch signal is inviteLinkCode.
    let storedInvite = await this.getOpenOrgInvite();
    if (storedInvite != null && storedInvite.inviteLinkCode !== invite.inviteLinkCode) {
      await this.clearOrganizationInvite();
      storedInvite = null;
    }
    const hasNotCheckedMasterPasswordYet = storedInvite == null;
    return hasMasterPasswordPolicy && hasNotCheckedMasterPasswordYet;
  }
}
