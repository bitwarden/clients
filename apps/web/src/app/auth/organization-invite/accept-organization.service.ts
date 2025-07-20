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
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { OrganizationInvite } from "@bitwarden/common/auth/services/organization-invite/organization-invite";
import { OrganizationInviteService } from "@bitwarden/common/auth/services/organization-invite/organization-invite.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { OrgKey } from "@bitwarden/common/types/key";
import { KeyService } from "@bitwarden/key-management";

@Injectable()
export class AcceptOrganizationInviteService {
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
    private readonly organizationInviteService: OrganizationInviteService,
    private readonly accountService: AccountService,
  ) {}

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
      await this.organizationInviteService.setOrganizationInvitation(invite);
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
    await this.organizationInviteService.clearOrganizationInvitation();
  }

  private async prepareAcceptAndInitRequest(
    invite: OrganizationInvite,
  ): Promise<OrganizationUserAcceptInitRequest> {
    const request = new OrganizationUserAcceptInitRequest();
    request.token = invite.token;

    const [encryptedOrgKey, orgKey] = await this.keyService.makeOrgKey<OrgKey>();
    const [orgPublicKey, encryptedOrgPrivateKey] = await this.keyService.makeKeyPair(orgKey);
    const collection = await this.encryptService.encryptString(
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
    await this.organizationInviteService.clearOrganizationInvitation();
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

    let storedInvite = await this.organizationInviteService.getOrganizationInvite();
    if (storedInvite?.email !== invite.email) {
      // clear stored invites if the email doesn't match
      await this.organizationInviteService.clearOrganizationInvitation();
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
