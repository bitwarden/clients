import { Component } from "@angular/core";
import { ActivatedRoute, Params, Router } from "@angular/router";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationUserService } from "@bitwarden/common/abstractions/organization-user/organization-user.service";
import {
  OrganizationUserAcceptInitRequest,
  OrganizationUserAcceptRequest,
} from "@bitwarden/common/abstractions/organization-user/requests";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { OrganizationKeysRequest } from "@bitwarden/common/admin-console/models/request/organization-keys.request";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { OrgKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";

import { BaseAcceptComponent } from "../common/base.accept.component";

@Component({
  selector: "app-accept-organization",
  templateUrl: "accept-organization.component.html",
})
export class AcceptOrganizationComponent extends BaseAcceptComponent {
  orgName: string;

  protected requiredParameters: string[] = ["organizationId", "organizationUserId", "token"];

  constructor(
    router: Router,
    platformUtilsService: PlatformUtilsService,
    i18nService: I18nService,
    route: ActivatedRoute,
    stateService: StateService,
    private cryptoService: CryptoService,
    private policyApiService: PolicyApiServiceAbstraction,
    private policyService: PolicyService,
    private logService: LogService,
    private organizationApiService: OrganizationApiServiceAbstraction,
    private organizationUserService: OrganizationUserService,
    private messagingService: MessagingService,
    private apiService: ApiService
  ) {
    super(router, platformUtilsService, i18nService, route, stateService);
  }

  async authedHandler(qParams: Params): Promise<void> {
    const initOrganization =
      qParams.initOrganization != null && qParams.initOrganization.toLocaleLowerCase() === "true";
    if (initOrganization) {
      this.actionPromise = this.acceptInitOrganizationFlow(qParams);
    } else {
      const needsReAuth = (await this.stateService.getOrganizationInvitation()) == null;
      if (needsReAuth) {
        // Accepting an org invite requires authentication from a logged out state
        this.messagingService.send("logout", { redirect: false });
        await this.prepareOrganizationInvitation(qParams);
        return;
      }

      // User has already logged in and passed the Master Password policy check
      this.actionPromise = this.acceptFlow(qParams);
    }

    await this.actionPromise;
    await this.apiService.refreshIdentityToken();
    await this.stateService.setOrganizationInvitation(null);
    this.platformUtilService.showToast(
      "success",
      this.i18nService.t("inviteAccepted"),
      initOrganization
        ? this.i18nService.t("inviteInitAcceptedDesc")
        : this.i18nService.t("inviteAcceptedDesc"),
      { timeout: 10000 }
    );
    this.router.navigate(["/vault"]);
  }

  async unauthedHandler(qParams: Params): Promise<void> {
    await this.prepareOrganizationInvitation(qParams);
  }

  private async acceptInitOrganizationFlow(qParams: Params): Promise<any> {
    return this.prepareAcceptInitRequest(qParams).then((request) =>
      this.organizationUserService.postOrganizationUserAcceptInit(
        qParams.organizationId,
        qParams.organizationUserId,
        request
      )
    );
  }

  private async acceptFlow(qParams: Params): Promise<any> {
    return this.prepareAcceptRequest(qParams).then((request) =>
      this.organizationUserService.postOrganizationUserAccept(
        qParams.organizationId,
        qParams.organizationUserId,
        request
      )
    );
  }

  private async prepareAcceptInitRequest(
    qParams: Params
  ): Promise<OrganizationUserAcceptInitRequest> {
    const request = new OrganizationUserAcceptInitRequest();
    request.token = qParams.token;

    const [encryptedOrgKey, orgKey] = await this.cryptoService.makeOrgKey<OrgKey>();
    const [orgPublicKey, encryptedOrgPrivateKey] = await this.cryptoService.makeKeyPair(orgKey);
    const collection = await this.cryptoService.encrypt(
      this.i18nService.t("defaultCollection"),
      orgKey
    );

    request.key = encryptedOrgKey.encryptedString;
    request.keys = new OrganizationKeysRequest(
      orgPublicKey,
      encryptedOrgPrivateKey.encryptedString
    );
    request.collectionName = collection.encryptedString;

    return request;
  }

  private async prepareAcceptRequest(qParams: Params): Promise<OrganizationUserAcceptRequest> {
    const request = new OrganizationUserAcceptRequest();
    request.token = qParams.token;

    if (await this.performResetPasswordAutoEnroll(qParams)) {
      const response = await this.organizationApiService.getKeys(qParams.organizationId);

      if (response == null) {
        throw new Error(this.i18nService.t("resetPasswordOrgKeysError"));
      }

      const publicKey = Utils.fromB64ToArray(response.publicKey);

      // RSA Encrypt user's encKey.key with organization public key
      const userKey = await this.cryptoService.getUserKey();
      const encryptedKey = await this.cryptoService.rsaEncrypt(userKey.key, publicKey);

      // Add reset password key to accept request
      request.resetPasswordKey = encryptedKey.encryptedString;
    }
    return request;
  }

  private async performResetPasswordAutoEnroll(qParams: Params): Promise<boolean> {
    let policyList: Policy[] = null;
    try {
      const policies = await this.policyApiService.getPoliciesByToken(
        qParams.organizationId,
        qParams.token,
        qParams.email,
        qParams.organizationUserId
      );
      policyList = this.policyService.mapPoliciesFromToken(policies);
    } catch (e) {
      this.logService.error(e);
    }

    if (policyList != null) {
      const result = this.policyService.getResetPasswordPolicyOptions(
        policyList,
        qParams.organizationId
      );
      // Return true if policy enabled and auto-enroll enabled
      return result[1] && result[0].autoEnrollEnabled;
    }

    return false;
  }

  private async prepareOrganizationInvitation(qParams: Params): Promise<void> {
    this.orgName = qParams.organizationName;
    if (this.orgName != null) {
      // Fix URL encoding of space issue with Angular
      this.orgName = this.orgName.replace(/\+/g, " ");
    }
    await this.stateService.setOrganizationInvitation(qParams);
  }
}
