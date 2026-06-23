import { firstValueFrom } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import {
  OrganizationUserAcceptInitRequest,
  OrganizationUserAcceptRequest,
  OrganizationUserApiService,
} from "@bitwarden/admin-console/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { OrganizationKeysRequest } from "@bitwarden/common/admin-console/models/request/organization-keys.request";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { OrganizationInvite } from "@bitwarden/common/auth/organization-invite/organization-invite";
import { ORGANIZATION_INVITE } from "@bitwarden/common/auth/organization-invite/organization-invite-state";
import { OrganizationInviteService } from "@bitwarden/common/auth/organization-invite/organization-invite.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { GlobalState, GlobalStateProvider } from "@bitwarden/common/platform/state";
import { OrgKey } from "@bitwarden/common/types/key";
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { KeyService } from "@bitwarden/key-management";
import { UserId } from "@bitwarden/user-core";

export class DefaultOrganizationInviteService implements OrganizationInviteService {
  private organizationInviteState: GlobalState<OrganizationInvite | null>;
  // In-memory dedup of policy lookups across one invite ceremony. The same invite
  // can be checked from login, registration, and accept in a single session;
  // keyed by invite token, cleared whenever the stored invite is set or cleared
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
    private readonly i18nService: I18nService,
    private readonly globalStateProvider: GlobalStateProvider,
  ) {
    this.organizationInviteState = this.globalStateProvider.get(ORGANIZATION_INVITE);
  }

  async getOrganizationInvite(): Promise<OrganizationInvite | null> {
    return await firstValueFrom(this.organizationInviteState.state$);
  }

  async setOrganizationInvite(invite: OrganizationInvite): Promise<void> {
    await this.organizationInviteState.update(() => invite);
    this.policyCache.clear();
  }

  async clearOrganizationInvite(): Promise<void> {
    await this.organizationInviteState.update(() => null);
    this.policyCache.clear();
  }

  /**
   * Validates and accepts the organization invite if possible.
   * Note: Users might need to pass a MP policy check before accepting an invite to an existing organization. If the user
   * has not passed this check, they will be logged out and the invite will be stored for later use.
   * @param invite an organization invite
   * @param userId the user ID of the active user accepting the invite
   * @returns a promise that resolves a boolean indicating if the invite was accepted.
   */
  async validateAndAcceptInvite(invite: OrganizationInvite, userId: UserId): Promise<boolean> {
    // Creation of a new org
    if (invite.initOrganization) {
      await this.acceptAndInitOrganization(invite, userId);
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
    if (await this.masterPasswordPolicyCheckRequired(invite)) {
      await this.setOrganizationInvite(invite);
      this.authService.logOut(() => {
        /* Do nothing */
      });
      return false;
    }

    // We know the user has already logged in and passed a MP policy check
    await this.accept(invite, userId);
    return true;
  }

  async getInvitePolicies(invite: OrganizationInvite): Promise<Policy[] | undefined> {
    const cached = this.policyCache.get(invite.token);
    if (cached != null) {
      return cached;
    }

    try {
      const policies = await this.policyApiService.getPoliciesByToken(
        invite.organizationId,
        invite.token,
        invite.email,
        invite.organizationUserId,
      );
      if (policies != null) {
        this.policyCache.set(invite.token, policies);
      }
      return policies;
    } catch (e) {
      this.logService.error(e);
      return undefined;
    }
  }

  async getMasterPasswordPolicyOptionsForInvite(
    invite: OrganizationInvite,
  ): Promise<MasterPasswordPolicyOptions | undefined> {
    const policies = await this.getInvitePolicies(invite);
    if (policies == null) {
      return undefined;
    }
    return this.policyService.combinePoliciesIntoMasterPasswordPolicyOptions(policies);
  }

  private async acceptAndInitOrganization(
    invite: OrganizationInvite,
    userId: UserId,
  ): Promise<void> {
    await this.prepareAcceptAndInitRequest(invite, userId).then((request) =>
      this.organizationUserApiService.postOrganizationUserAcceptInit(
        invite.organizationId,
        invite.organizationUserId,
        request,
      ),
    );
    await this.apiService.refreshIdentityToken();
    await this.clearOrganizationInvite();
  }

  private async prepareAcceptAndInitRequest(
    invite: OrganizationInvite,
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

  private async accept(invite: OrganizationInvite, userId: UserId): Promise<void> {
    await this.prepareAcceptRequest(invite, userId).then((request) =>
      this.organizationUserApiService.postOrganizationUserAccept(
        invite.organizationId,
        invite.organizationUserId,
        request,
      ),
    );

    await this.apiService.refreshIdentityToken();
    await this.clearOrganizationInvite();
  }

  private async prepareAcceptRequest(
    invite: OrganizationInvite,
    userId: UserId,
  ): Promise<OrganizationUserAcceptRequest> {
    const request = new OrganizationUserAcceptRequest();
    request.token = invite.token;

    if (await this.resetPasswordEnrollRequired(invite)) {
      const response = await this.organizationApiService.getKeys(invite.organizationId);

      if (response == null) {
        throw new Error(this.i18nService.t("resetPasswordOrgKeysError"));
      }

      const publicKey = Utils.fromB64ToArray(response.publicKey);

      const userKey = await firstValueFrom(this.keyService.userKey$(userId));
      if (userKey == null) {
        throw new Error("User key is required to enroll in password reset.");
      }

      // RSA Encrypt user's encKey.key with organization public key
      const encryptedKey = await this.encryptService.encapsulateKeyUnsigned(userKey, publicKey);
      if (encryptedKey.encryptedString == null) {
        throw new Error("Failed to encrypt user key for password reset enrollment.");
      }

      // Add reset password key to accept request
      request.resetPasswordKey = encryptedKey.encryptedString;
    }
    return request;
  }

  private async resetPasswordEnrollRequired(invite: OrganizationInvite): Promise<boolean> {
    const policies = await this.getInvitePolicies(invite);

    if (policies == null || policies.length === 0) {
      return false;
    }

    const result = this.policyService.getResetPasswordPolicyOptions(
      policies,
      invite.organizationId,
    );
    // Return true if policy enabled and auto-enroll enabled
    return result[1] && result[0].autoEnrollEnabled;
  }

  private async masterPasswordPolicyCheckRequired(invite: OrganizationInvite): Promise<boolean> {
    const policies = await this.getInvitePolicies(invite);

    if (policies == null || policies.length === 0) {
      return false;
    }
    const hasMasterPasswordPolicy = policies.some(
      (p) => p.type === PolicyType.MasterPassword && p.enabled,
    );

    let storedInvite = await this.getOrganizationInvite();
    if (storedInvite != null && storedInvite.email !== invite.email) {
      // clear stored invites if the email doesn't match
      await this.clearOrganizationInvite();
      storedInvite = null;
    }
    // if we don't have an org invite stored, we know the user hasn't been redirected yet to check the MP policy
    const hasNotCheckedMasterPasswordYet = storedInvite == null;
    return hasMasterPasswordPolicy && hasNotCheckedMasterPasswordYet;
  }
}
