// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
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
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { OrganizationKeysRequest } from "@bitwarden/common/admin-console/models/request/organization-keys.request";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
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
  private organizationInvitationState: GlobalState<OrganizationInvite | null>;
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
    private readonly accountService: AccountService,
    private readonly globalStateProvider: GlobalStateProvider,
  ) {
    this.organizationInvitationState = this.globalStateProvider.get(ORGANIZATION_INVITE);
  }

  async getOrganizationInvite(): Promise<OrganizationInvite | null> {
    return await firstValueFrom(this.organizationInvitationState.state$);
  }

  async setOrganizationInvitation(invite: OrganizationInvite): Promise<void> {
    await this.organizationInvitationState.update(() => invite);
    this.policyCache.clear();
  }

  async clearOrganizationInvitation(): Promise<void> {
    await this.organizationInvitationState.update(() => null);
    this.policyCache.clear();
  }

  /**
   * Validates and accepts the organization invitation if possible.
   * Note: Users might need to pass a MP policy check before accepting an invite to an existing organization. If the user
   * has not passed this check, they will be logged out and the invite will be stored for later use.
   * @param invite an organization invite
   * @param activeUserId the user ID of the active user accepting the invite
   * @returns a promise that resolves a boolean indicating if the invite was accepted.
   */
  async validateAndAcceptInvite(
    invite: OrganizationInvite,
    activeUserId: UserId,
  ): Promise<boolean> {
    // Creation of a new org
    if (invite.initOrganization) {
      await this.acceptAndInitOrganization(invite, activeUserId);
      return true;
    }

    // Accepting an org invite from existing org
    if (await this.masterPasswordPolicyCheckRequired(invite)) {
      await this.setOrganizationInvitation(invite);
      this.authService.logOut(() => {
        /* Do nothing */
      });
      return false;
    }

    // We know the user has already logged in and passed a MP policy check
    await this.accept(invite);
    return true;
  }

  async getInvitePolicies(invite: OrganizationInvite): Promise<Policy[] | null> {
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
      return null;
    }
  }

  private async acceptAndInitOrganization(
    invite: OrganizationInvite,
    activeUserId: UserId,
  ): Promise<void> {
    await this.prepareAcceptAndInitRequest(invite, activeUserId).then((request) =>
      this.organizationUserApiService.postOrganizationUserAcceptInit(
        invite.organizationId,
        invite.organizationUserId,
        request,
      ),
    );
    await this.apiService.refreshIdentityToken();
    await this.clearOrganizationInvitation();
  }

  private async prepareAcceptAndInitRequest(
    invite: OrganizationInvite,
    activeUserId: UserId,
  ): Promise<OrganizationUserAcceptInitRequest> {
    const [encryptedOrgKey, orgKey] = await this.keyService.makeOrgKey<OrgKey>(activeUserId);
    const [orgPublicKey, encryptedOrgPrivateKey] = await this.keyService.makeKeyPair(orgKey);
    const collection = await this.encryptService.encryptString(
      this.i18nService.t("defaultCollection"),
      orgKey,
    );

    return new OrganizationUserAcceptInitRequest(
      invite.token,
      encryptedOrgKey.encryptedString,
      new OrganizationKeysRequest(orgPublicKey, encryptedOrgPrivateKey.encryptedString),
      collection.encryptedString,
    );
  }

  private async accept(invite: OrganizationInvite): Promise<void> {
    await this.prepareAcceptRequest(invite).then((request) =>
      this.organizationUserApiService.postOrganizationUserAccept(
        invite.organizationId,
        invite.organizationUserId,
        request,
      ),
    );

    await this.apiService.refreshIdentityToken();
    await this.clearOrganizationInvitation();
  }

  private async prepareAcceptRequest(
    invite: OrganizationInvite,
  ): Promise<OrganizationUserAcceptRequest> {
    const request = new OrganizationUserAcceptRequest();
    request.token = invite.token;

    if (await this.resetPasswordEnrollRequired(invite)) {
      const response = await this.organizationApiService.getKeys(invite.organizationId);

      if (response == null) {
        throw new Error(this.i18nService.t("resetPasswordOrgKeysError"));
      }

      const publicKey = Utils.fromB64ToArray(response.publicKey);

      const activeUserId = (await firstValueFrom(this.accountService.activeAccount$)).id;
      const userKey = await firstValueFrom(this.keyService.userKey$(activeUserId));
      // RSA Encrypt user's encKey.key with organization public key
      const encryptedKey = await this.encryptService.encapsulateKeyUnsigned(userKey, publicKey);

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
    if (storedInvite?.email !== invite.email) {
      // clear stored invites if the email doesn't match
      await this.clearOrganizationInvitation();
      storedInvite = null;
    }
    // if we don't have an org invite stored, we know the user hasn't been redirected yet to check the MP policy
    const hasNotCheckedMasterPasswordYet = storedInvite == null;
    return hasMasterPasswordPolicy && hasNotCheckedMasterPasswordYet;
  }
}
