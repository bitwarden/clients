import { firstValueFrom } from "rxjs";

import {
  DefaultRegistrationFinishService,
  PasswordInputResult,
  RegistrationFinishService,
} from "@bitwarden/auth/angular";
import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { AccountApiService } from "@bitwarden/common/auth/abstractions/account-api.service";
import { RegisterFinishRequest } from "@bitwarden/common/auth/models/request/registration/register-finish.request";
import { KeysRequest } from "@bitwarden/common/models/request/keys.request";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { EncryptedString, EncString } from "@bitwarden/common/platform/models/domain/enc-string";

import { AcceptOrganizationInviteService } from "../../../organization-invite/accept-organization.service";

export class WebRegistrationFinishService
  extends DefaultRegistrationFinishService
  implements RegistrationFinishService
{
  constructor(
    protected cryptoService: CryptoService,
    protected accountApiService: AccountApiService,
    private acceptOrgInviteService: AcceptOrganizationInviteService,
    private policyApiService: PolicyApiServiceAbstraction,
    private logService: LogService,
    private policyService: PolicyService,
  ) {
    super(cryptoService, accountApiService);
  }

  override async getMasterPasswordPolicyOptsFromOrgInvite(): Promise<MasterPasswordPolicyOptions | null> {
    // If there's a deep linked org invite, use it to get the password policies
    const orgInvite = await this.acceptOrgInviteService.getOrganizationInvite();

    if (orgInvite == null) {
      return null;
    }

    let policies: Policy[] | null = null;
    try {
      policies = await this.policyApiService.getPoliciesByToken(
        orgInvite.organizationId,
        orgInvite.token,
        orgInvite.email,
        orgInvite.organizationUserId,
      );
    } catch (e) {
      this.logService.error(e);
    }

    if (policies == null) {
      return null;
    }

    const masterPasswordPolicyOpts: MasterPasswordPolicyOptions = await firstValueFrom(
      this.policyService.masterPasswordPolicyOptions$(policies),
    );

    return masterPasswordPolicyOpts;
  }

  // Note: the org invite token and email verification are mutually exclusive. Only one will be present.
  override async buildRegisterRequest(
    email: string,
    emailVerificationToken: string,
    passwordInputResult: PasswordInputResult,
    encryptedUserKey: EncryptedString,
    userAsymmetricKeys: [string, EncString],
  ): Promise<RegisterFinishRequest> {
    const userAsymmetricKeysRequest = new KeysRequest(
      userAsymmetricKeys[0],
      userAsymmetricKeys[1].encryptedString,
    );

    const registerRequest = new RegisterFinishRequest(
      email,
      emailVerificationToken,
      passwordInputResult.masterKeyHash,
      passwordInputResult.hint,
      encryptedUserKey,
      userAsymmetricKeysRequest,
      passwordInputResult.kdfConfig.kdfType,
      passwordInputResult.kdfConfig.iterations,
    );

    // web specific logic
    // Org invites are deep linked. Non-existent accounts are redirected to the register page.
    // Org user id and token are included here only for validation and two factor purposes.
    const orgInvite = await this.acceptOrgInviteService.getOrganizationInvite();
    if (orgInvite != null) {
      registerRequest.organizationUserId = orgInvite.organizationUserId;
      registerRequest.orgInviteToken = orgInvite.token;
    }
    // Invite is accepted after login (on deep link redirect).

    return registerRequest;
  }
}
