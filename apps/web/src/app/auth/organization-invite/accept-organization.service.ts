// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Injectable } from "@angular/core";
import { BehaviorSubject, firstValueFrom, map } from "rxjs";

import {
  OrganizationUserApiService,
  OrganizationUserAcceptRequest,
  OrganizationUserAcceptInitRequest,
} from "@bitwarden/admin-console/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { OrganizationKeysRequest } from "@bitwarden/common/admin-console/models/request/organization-keys.request";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import {
  GlobalState,
  GlobalStateProvider,
  KeyDefinition,
  ORGANIZATION_INVITE_DISK,
} from "@bitwarden/common/platform/state";
import { OrgKey } from "@bitwarden/common/types/key";
import { KeyService } from "@bitwarden/key-management";

import { OrganizationInvite } from "./organization-invite";

// We're storing the organization invite for 2 reasons:
// 1. If the org requires a MP policy check, we need to keep track that the user has already been redirected when they return.
// 2. The MP policy check happens on login/register flows, we need to store the token to retrieve the policies then.
export const ORGANIZATION_INVITE = new KeyDefinition<OrganizationInvite | null>(
  ORGANIZATION_INVITE_DISK,
  "organizationInvite",
  {
    deserializer: (invite) => (invite ? OrganizationInvite.fromJSON(invite) : null),
  },
);

@Injectable()
export class AcceptOrganizationInviteService {
  private organizationInvitationState: GlobalState<OrganizationInvite | null>;
  private orgNameSubject: BehaviorSubject<string> = new BehaviorSubject<string>(null);
  private policyCache: Policy[];

  // Fix URL encoding of space issue with Angular
  orgName$ = this.orgNameSubject.pipe(map((orgName) => orgName.replace(/\+/g, " ")));

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
    this.organizationInvitationState = this.globalStateProvider.get(ORGANIZATION_INVITE);
  }

  /** Returns the currently stored organization invite */
  async getOrganizationInvite(): Promise<OrganizationInvite | null> {
    return await firstValueFrom(this.organizationInvitationState.state$);
  }

  /**
   * Stores a new organization invite
   * @param invite an organization invite
   * @throws if the invite is nullish
   */
  async setOrganizationInvitation(invite: OrganizationInvite): Promise<void> {
    if (invite == null) {
      throw new Error("Invite cannot be null. Use clearOrganizationInvitation instead.");
    }
    await this.organizationInvitationState.update(() => invite);
  }

  /** Clears the currently stored organization invite */
  async clearOrganizationInvitation(): Promise<void> {
    await this.organizationInvitationState.update(() => null);
  }

  /**
   * Validates and accepts the organization invitation if possible.
   * Note: Users might need to pass a MP policy check before accepting an invite to an existing organization. If the user
   * has not passed this check, they will be logged out and the invite will be stored for later use.
   * @param invite an organization invite
   * @returns a promise that resolves a boolean indicating if the invite was accepted.
   */
  async validateAndAcceptInvite(invite: OrganizationInvite): Promise<boolean> {
    if (invite == null) {
      throw new Error("Invite cannot be null.");
    }

    // Creation of a new org
    if (invite.initOrganization) {
      await this.acceptAndInitOrganization(invite);
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

  private async acceptAndInitOrganization(invite: OrganizationInvite): Promise<void> {
    await this.prepareAcceptAndInitRequest(invite).then((request) =>
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
  ): Promise<OrganizationUserAcceptInitRequest> {
    const request = new OrganizationUserAcceptInitRequest();
    request.token = invite.token;

    const [encryptedOrgKey, orgKey] = await this.keyService.makeOrgKey<OrgKey>();
    const [orgPublicKey, encryptedOrgPrivateKey] = await this.keyService.makeKeyPair(orgKey);
    const collection = await this.encryptService.encrypt(
      this.i18nService.t("defaultCollection"),
      orgKey,
    );

    request.key = encryptedOrgKey.encryptedString;
    request.keys = new OrganizationKeysRequest(
      orgPublicKey,
      encryptedOrgPrivateKey.encryptedString,
    );
    request.collectionName = collection.encryptedString;

    return request;
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

      // RSA Encrypt user's encKey.key with organization public key
      const userKey = await this.keyService.getUserKey();
      const encryptedKey = await this.encryptService.rsaEncrypt(userKey.key, publicKey);

      // Add reset password key to accept request
      request.resetPasswordKey = encryptedKey.encryptedString;
    }
    return request;
  }

  private async resetPasswordEnrollRequired(invite: OrganizationInvite): Promise<boolean> {
    const policies = await this.getPolicies(invite);

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
    const policies = await this.getPolicies(invite);

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

  private async getPolicies(invite: OrganizationInvite): Promise<Policy[] | null> {
    // if policies are not cached, fetch them
    if (this.policyCache == null) {
      try {
        this.policyCache = await this.policyApiService.getPoliciesByToken(
          invite.organizationId,
          invite.token,
          invite.email,
          invite.organizationUserId,
        );
      } catch (e) {
        this.logService.error(e);
      }
    }

    return this.policyCache;
  }
}
