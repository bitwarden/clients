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
import { LogoutService } from "@bitwarden/auth/common";
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
  HighEntropySecret,
  isInviteLinkError,
  isRegistrationError,
  OpenOrgInvite,
  OrganizationId as SdkOrganizationId,
  PasswordManagerClient,
  SealedOpenOrgInvite,
  SealedOpenOrgInviteData,
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
import { DeepLinkRedirectService } from "../../../deep-link-redirect";
import { OrgInviteKind } from "../../enums/org-invite-kind.enum";
import { DirectOrganizationInvite } from "../../models/direct-organization-invite";
import {
  OpenOrganizationInvite,
  OpenOrgInviteLinkData,
} from "../../models/open-organization-invite";
import {
  OpenOrgInviteAcceptError,
  OpenOrgInviteAcceptResult,
} from "../../types/open-org-invite-accept-result.type";
import { OpenOrgInviteStatusResult } from "../../types/open-org-invite-status-result.type";
import { OpenOrgInviteSsoConfig } from "../../types/open-org-invite-status.type";
import { OpenOrgInviteUnsealResult } from "../../types/open-org-invite-unseal-result.type";
import { OpenOrgInviteValidateEmailDomainResult } from "../../types/open-org-invite-validate-email-domain-result.type";
import { OrganizationInvite } from "../../types/organization-invite.type";
import { OrganizationInviteService } from "../organization-invite.service";

import { DIRECT_ORGANIZATION_INVITE, OPEN_ORGANIZATION_INVITE } from "./organization-invite.state";
import {
  EMAIL_SEALED_OPEN_ORG_INVITE_SECRET_RECORD_DISK_LOCAL,
  SEALED_OPEN_ORG_INVITE_SECRET_TTL_MS,
  SealedOpenOrgInviteSecretState,
} from "./sealed-open-org-invite-secret.state";

export class DefaultOrganizationInviteService implements OrganizationInviteService {
  private directOrgInviteState: GlobalState<DirectOrganizationInvite | null>;
  private openOrgInviteState: GlobalState<OpenOrganizationInvite | null>;
  /**
   * Record of `{ email → { highEntropySecret, createdAtMs } }` for in-flight
   * open-organization-invite registration crossings. Web-only (`disk-local`); pruned by
   * {@link clearExpiredSealedOpenOrgInviteSecrets} on APP_INITIALIZER boot.
   */
  private sealedOpenOrgInviteSecretState: GlobalState<
    Record<string, SealedOpenOrgInviteSecretState>
  >;
  readonly activeInvite$: Observable<OrganizationInvite | null>;
  // In-memory dedup of policy lookups across one invite ceremony. The same invite
  // can be checked from login, registration, and accept in a single session;
  // keyed by invite token, cleared whenever a stored invite is set or cleared
  // so a transition can't leak stale entries.
  private policyCache = new Map<string, Policy[]>();

  constructor(
    private readonly apiService: ApiService,
    private readonly logoutService: LogoutService,
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
    private readonly deepLinkRedirectService: DeepLinkRedirectService,
  ) {
    this.directOrgInviteState = this.globalStateProvider.get(DIRECT_ORGANIZATION_INVITE);
    this.openOrgInviteState = this.globalStateProvider.get(OPEN_ORGANIZATION_INVITE);
    this.sealedOpenOrgInviteSecretState = this.globalStateProvider.get(
      EMAIL_SEALED_OPEN_ORG_INVITE_SECRET_RECORD_DISK_LOCAL,
    );
    this.activeInvite$ = combineLatest([
      this.directOrgInviteState.state$,
      this.openOrgInviteState.state$,
    ]).pipe(map(([direct, open]) => direct ?? open));
  }

  async getOrganizationInvite(): Promise<OrganizationInvite | null> {
    return await firstValueFrom(this.activeInvite$);
  }

  /**
   * Kind-specific read of the direct-invite state key. Used internally by paths (e.g.
   * the MP-policy detour checks) that must not treat a stashed open invite as belonging
   * to the direct-invite flow. External callers should keep using
   * {@link getOrganizationInvite} for the merged view — there is no external consumer
   * that needs the direct variant in isolation today.
   */
  private async getDirectOrgInvite(): Promise<DirectOrganizationInvite | null> {
    return await firstValueFrom(this.directOrgInviteState.state$);
  }

  async getOpenOrgInvite(): Promise<OpenOrganizationInvite | null> {
    return await firstValueFrom(this.openOrgInviteState.state$);
  }

  async setOrganizationInvite(invite: OrganizationInvite): Promise<void> {
    switch (invite.kind) {
      case OrgInviteKind.Direct:
        await this.directOrgInviteState.update(() => invite);
        await this.openOrgInviteState.update(() => null);
        break;
      case OrgInviteKind.Open:
        await this.openOrgInviteState.update(() => invite);
        await this.directOrgInviteState.update(() => null);
        break;
    }
    this.policyCache.clear();
  }

  async clearOrganizationInvite(): Promise<void> {
    await this.directOrgInviteState.update(() => null);
    await this.openOrgInviteState.update(() => null);
    this.policyCache.clear();
  }

  async clearOpenOrgInvite(): Promise<void> {
    await this.openOrgInviteState.update(() => null);
    this.policyCache.clear();
  }

  async validateAndAcceptDirectOrgInvite(
    invite: DirectOrganizationInvite,
    userId: UserId,
    postAuthRedirectUrl: string,
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
      // Persist so the deep-link guard replays us back into accept after the user
      // re-authenticates with a compliant master password.
      await this.deepLinkRedirectService.persistPostLoginRedirectUrl(postAuthRedirectUrl);
      await this.logoutService.logout(userId);
      return false;
    }

    // We know the user has already logged in and passed a MP policy check
    await this.acceptDirectOrgInvite(invite, userId);
    return true;
  }

  async acceptOpenOrgInvite(
    invite: OpenOrganizationInvite,
    userId: UserId,
    postAuthRedirectUrl: string,
  ): Promise<OpenOrgInviteAcceptResult> {
    // MP-policy detour for open org invites: if the org requires a compliant MP and the
    // user hasn't been through the detour yet (no matching stash), persist + log out
    // so login can re-check the MP against their current password.
    //
    // Reached when an already-authenticated user hits /join/:orgId/:code with no
    // stashed open invite — either a paste-into-authed-session (unauthedHandler
    // never ran) or a retry after a failed accept (the catch block below cleared
    // the stash). Every other entry (unauthed click → login → deep-link replay,
    // registration crossing, post-detour re-login) has a matching stash present,
    // so `openOrgInviteMasterPasswordPolicyCheckRequired` returns false and this
    // branch is skipped.
    if (await this.openOrgInviteMasterPasswordPolicyCheckRequired(invite)) {
      await this.setOrganizationInvite(invite);
      // Persist so the deep-link guard replays us back into accept after the user
      // re-authenticates with a compliant master password.
      await this.deepLinkRedirectService.persistPostLoginRedirectUrl(postAuthRedirectUrl);
      await this.logoutService.logout(userId);
      return { kind: "stashed-for-mp-policy-detour" };
    }

    const enrollIntoAccountRecovery =
      await this.openOrgInviteRequiresResetPasswordAutoEnroll(invite);
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
      // Any classified accept failure leaves the invite consumed from the caller's
      // POV — drop the stash so downstream MP-policy consumers on the same tab
      // don't apply the failed org's policy.
      await this.clearOpenOrgInvite();
      return this.classifyOpenOrgInviteAcceptError(e);
    }
  }

  /**
   * Top-level classifier for accept-flow errors. Branches, in order:
   *   1. Not an `InviteLinkError` → `unexpected` with an extracted message.
   *   2. `RecoveryKeyMismatch` → `recovery-key-mismatch`; signals org-key substitution.
   *   3. Any other non-`Api` variant → `unexpected` with the SDK message.
   *   4. `Api` variant → unwrap the `ApiError::Response` display string and delegate to
   *      {@link classifyOpenOrgInviteAcceptApiError}, or `unexpected` if the format has drifted.
   */
  private classifyOpenOrgInviteAcceptError(e: unknown): OpenOrgInviteAcceptError {
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
    //
    // Current format: `Received error message from server: [<status> <reason>] <json-body>`
    // where `<json-body>` is the full server error response (`{ "message": "...", ... }`).
    // We capture the numeric status (reason phrase discarded) and JSON-parse the body to
    // pull the bare `.message` string that `classifyOpenOrgInviteAcceptApiError` matches on.
    // `[\s\S]` in lieu of the `s` (dotAll) flag, which requires ES2018+.
    const match = e.message.match(
      /^Received error message from server: \[(\d+)[^\]]*\] ([\s\S]+)$/,
    );
    if (match == null) {
      return { kind: "unexpected", errorMessage: e.message };
    }
    const statusCode = Number(match[1]);
    try {
      const { message } = JSON.parse(match[2]) as { message?: unknown };
      if (typeof message === "string") {
        return this.classifyOpenOrgInviteAcceptApiError(statusCode, message);
      }
    } catch {
      // JSON.parse threw, or destructure on null/undefined threw — fall through
      // to the shared `unexpected` return below.
    }
    return { kind: "unexpected", errorMessage: e.message };
  }

  private classifyOpenOrgInviteAcceptApiError(
    statusCode: number,
    message: string,
  ): OpenOrgInviteAcceptError {
    if (statusCode === 404) {
      return { kind: "link-not-found" };
    }
    if (statusCode !== 400) {
      return { kind: "unexpected", errorMessage: message };
    }
    // TODO: hardcoded server-message matching is temporary. AC plans to expose stable
    // error codes with a better response shape in an upcoming milestone; migrate all
    // branches below to match on code rather than message text when that lands.
    if (message === "Your organization's plan does not support invite links.") {
      return { kind: "plan-not-supported" };
    }
    // Server interpolates the org name: "You're not allowed to join the {OrgName} vault with your email domain."
    if (/^You're not allowed to join the .+ vault with your email domain\.$/.test(message)) {
      return { kind: "email-domain-not-allowed" };
    }
    // Server interpolates the org name: "You're already a member of {OrgName}."
    if (/^You're already a member of .+\.$/.test(message)) {
      return { kind: "already-member" };
    }
    // Server interpolates the org name: "Your access to the {OrgName} vault has been revoked."
    if (/^Your access to the .+ vault has been revoked\.$/.test(message)) {
      return { kind: "org-access-revoked" };
    }
    // Server interpolates the org name: "The {OrgName} vault has no available seats."
    if (/^The .+ vault has no available seats\.$/.test(message)) {
      return { kind: "no-seats" };
    }
    // SeatAddFailed reads the same to the user as OrganizationHasNoAvailableSeats — both
    // mean "seat unavailable"; the distinction is billing plumbing the user can't act on.
    if (
      message === "Unable to join this vault right now. Please contact your organization admin."
    ) {
      return { kind: "no-seats" };
    }
    if (
      message ===
      "You cannot join this organization vault until you enable two-step login on your user account."
    ) {
      return { kind: "two-factor-required" };
    }
    if (message === "You must verify your email address before joining an organization.") {
      return { kind: "email-not-verified" };
    }
    // Target org has single-org policy on + user is in other orgs.
    if (
      message ===
      "Member cannot join this organization vault until they leave all other organization vaults."
    ) {
      return { kind: "single-org-policy-violation-target-org" };
    }
    // Another org the user belongs to has single-org policy on.
    if (
      message ===
      "Member cannot join this organization's vault because they are a member of another organization which forbids it."
    ) {
      return { kind: "single-org-policy-violation-other-org" };
    }
    // Target org's auto-confirm on + user has multiple memberships. Server interpolates
    // the user's email: "Cannot confirm {Email} until they leave all other organization vaults."
    if (/^Cannot confirm .+ until they leave all other organization vaults\.$/.test(message)) {
      return { kind: "auto-confirm-policy-violation-target-org" };
    }
    // Another org the user belongs to has auto-confirm on. Server interpolates the user's
    // email: "Cannot confirm {Email} because they are a member of another organization which forbids it."
    if (
      /^Cannot confirm .+ because they are a member of another organization which forbids it\.$/.test(
        message,
      )
    ) {
      return { kind: "auto-confirm-policy-violation-other-org" };
    }
    if (message === "Provider users cannot join organization vaults via invite link.") {
      return { kind: "provider-users-disallowed" };
    }
    if (message === "You can only be an admin of 1 free organization vault.") {
      return { kind: "free-admin-limit-reached" };
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
        await this.clearOpenOrgInvite();
        return { kind: "plan-not-supported", organizationName: response.organizationName };
      }
      if (!response.seatsAvailable) {
        await this.clearOpenOrgInvite();
        return { kind: "no-seats", organizationName: response.organizationName };
      }
      const sso: OpenOrgInviteSsoConfig | null =
        response.sso == null
          ? null
          : { orgSsoId: response.sso.orgSsoId, required: response.sso.required };
      return { kind: "ok", status: { organizationName: response.organizationName, sso } };
    } catch (e) {
      if (e instanceof ErrorResponse && e.statusCode === 404) {
        await this.clearOpenOrgInvite();
        return { kind: "not-found" };
      }
      // `unexpected` covers transient failures (network, 5xx, non-`ErrorResponse` throws).
      // Preserve the stash so a retry after a blip doesn't force a second MP-policy
      // detour on orgs whose invite the user has already validated against.
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

  async validateOpenOrgInviteEmailDomain(
    organizationId: string,
    code: string,
    email: string,
  ): Promise<OpenOrgInviteValidateEmailDomainResult> {
    try {
      const response = await this.organizationInviteLinkApiService.validateEmailDomain(
        new OrganizationInviteLinkValidateEmailDomainRequest({ organizationId, code, email }),
      );
      return response.isAllowed ? { kind: "allowed" } : { kind: "not-allowed" };
    } catch (e) {
      if (e instanceof ErrorResponse && e.statusCode === 404) {
        return { kind: "link-invalid" };
      }
      return { kind: "unexpected", errorMessage: this.extractErrorMessage(e) };
    }
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

  private async getSealedOpenOrgInviteSecret(email: string): Promise<string | null> {
    const key = this.normalizeEmailKey(email);
    const record = await firstValueFrom(this.sealedOpenOrgInviteSecretState.state$);
    return record?.[key]?.highEntropySecret ?? null;
  }

  async sealOpenOrgInvite(email: string, invite: OpenOrgInviteLinkData): Promise<string | null> {
    // TODO: clean up when FeatureFlag.GenerateInviteLink is removed — drop this
    // guard clause and update the abstraction JSDoc that documents it.
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

  async unsealOpenOrgInvite(email: string, sealedData: string): Promise<OpenOrgInviteUnsealResult> {
    const highEntropySecret = await this.getSealedOpenOrgInviteSecret(email);
    if (highEntropySecret == null) {
      return { kind: "secret-miss" };
    }
    try {
      const client: PasswordManagerClient = await firstValueFrom(this.sdkService.client$);
      const unsealed: OpenOrgInvite = client
        .auth()
        .registration()
        .unseal_open_org_invite_data({
          sealedData: sealedData as SealedOpenOrgInviteData,
          highEntropySecret: highEntropySecret as HighEntropySecret,
        });
      return {
        kind: "ok",
        invite: {
          organizationId: unsealed.organizationId,
          inviteLinkCode: unsealed.inviteLinkCode,
          inviteKey: unsealed.inviteSecret,
        },
      };
    } catch (e) {
      return this.classifyOpenOrgInviteUnsealError(e);
    }
  }

  /**
   * Classifies unseal failures by inspecting the SDK's `RegistrationError` surface.
   * The `Crypto` variant covers both a mismatched paired secret and a tampered blob —
   * both indistinguishable at this layer. Any non-`RegistrationError` throw (WASM
   * boundary error, unrelated runtime exception) falls through to `unexpected` with a
   * best-effort message.
   */
  private classifyOpenOrgInviteUnsealError(e: unknown): OpenOrgInviteUnsealResult {
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

  async clearExpiredSealedOpenOrgInviteSecrets(): Promise<void> {
    const nowMs = Date.now();
    await this.sealedOpenOrgInviteSecretState.update((record) => {
      if (record == null) {
        return record;
      }
      let anyExpired = false;
      const next: Record<string, SealedOpenOrgInviteSecretState> = {};
      for (const [email, entry] of Object.entries(record)) {
        // Strict `>` so entries at the TTL boundary survive clock jitter.
        if (nowMs - entry.createdAtMs > SEALED_OPEN_ORG_INVITE_SECRET_TTL_MS) {
          anyExpired = true;
          continue;
        }
        next[email] = entry;
      }
      // Preserve the reference when nothing expired so the state provider skips the disk-local write.
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
   * Whether accepting this open org invite should enroll the user in account recovery,
   * per the org's ResetPassword policy.
   */
  private async openOrgInviteRequiresResetPasswordAutoEnroll(
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

  /**
   * Whether this invite requires the user to re-authenticate against the org's
   * master-password policy before it can be accepted.
   *
   * NOTE: this check uses "matching stashed invite exists" as a proxy for "user has
   * been through the MP-policy re-auth flow." That's only correct because
   * `PasswordLoginStrategy` independently re-checks the stashed invite's policy at
   * login and force-routes weak-MP users to change-password — the invite service
   * silently depends on that safety net for the joining org's MP policy to be
   * enforced client-side.
   *
   * @param invite - The invite being validated.
   * @param readStash - Returns the invite stashed on a prior re-authentication
   *   attempt, or null if none exists.
   * @param matchesStash - Whether a stashed invite pertains to the same invite as
   *   the one being validated; a mismatch is treated as stale.
   * @returns True when the user must be re-authenticated before the invite can be
   *   accepted.
   */
  private async masterPasswordPolicyCheckRequired<T extends OrganizationInvite>(
    invite: T,
    readStash: () => Promise<T | null>,
    matchesStash: (stored: T) => boolean,
  ): Promise<boolean> {
    const policies = await this.getOrgPoliciesForInvite(invite);
    if (policies == null || policies.length === 0) {
      return false;
    }
    const hasMasterPasswordPolicy = policies.some(
      (p) => p.type === PolicyType.MasterPassword && p.enabled,
    );
    if (!hasMasterPasswordPolicy) {
      return false;
    }

    const storedInvite = await readStash();
    if (storedInvite != null && !matchesStash(storedInvite)) {
      // Stale same-kind stash from a different ceremony; clear so the detour fires fresh.
      await this.clearOrganizationInvite();
      return true;
    }
    // No stash → user hasn't been redirected through the MP check yet.
    return storedInvite == null;
  }

  private directInviteMasterPasswordPolicyCheckRequired(
    invite: DirectOrganizationInvite,
  ): Promise<boolean> {
    return this.masterPasswordPolicyCheckRequired(
      invite,
      () => this.getDirectOrgInvite(),
      (stored) => stored.email === invite.email,
    );
  }

  private openOrgInviteMasterPasswordPolicyCheckRequired(
    invite: OpenOrganizationInvite,
  ): Promise<boolean> {
    return this.masterPasswordPolicyCheckRequired(
      invite,
      () => this.getOpenOrgInvite(),
      (stored) => stored.inviteLinkCode === invite.inviteLinkCode,
    );
  }
}
