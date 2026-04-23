// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { AccountApiService } from "@bitwarden/common/auth/abstractions/account-api.service";
import { RegisterFinishRequest } from "@bitwarden/common/auth/models/request/registration/register-finish.request";
import { assertNonNullish, assertTruthy } from "@bitwarden/common/auth/utils";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { MasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { KeysRequest } from "@bitwarden/common/models/request/keys.request";
import { UserKey } from "@bitwarden/common/types/key";
import { KeyService } from "@bitwarden/key-management";

import { PasswordInputResult } from "../../input-password/password-input-result";

import { RegistrationFinishService } from "./registration-finish.service";

export class DefaultRegistrationFinishService implements RegistrationFinishService {
  constructor(
    protected keyService: KeyService,
    protected accountApiService: AccountApiService,
    protected masterPasswordService: MasterPasswordServiceAbstraction,
  ) {}

  getOrgNameFromOrgInvite(): Promise<string | null> {
    return null;
  }

  getMasterPasswordPolicyOptsFromOrgInvite(): Promise<MasterPasswordPolicyOptions | null> {
    return null;
  }

  async finishRegistration(
    email: string,
    passwordInputResult: PasswordInputResult,
    emailVerificationToken?: string,
    orgSponsoredFreeFamilyPlanToken?: string,
    acceptEmergencyAccessInviteToken?: string,
    emergencyAccessId?: string,
    providerInviteToken?: string,
    providerUserId?: string,
  ): Promise<void> {
    const ctx = "Could not finish registration.";
    assertTruthy(passwordInputResult.newPassword, "newPassword", ctx);
    assertNonNullish(passwordInputResult.kdfConfig, "kdfConfig", ctx);
    assertTruthy(passwordInputResult.salt, "salt", ctx);

    const newMasterKey = await this.keyService.makeMasterKey(
      passwordInputResult.newPassword,
      passwordInputResult.salt,
      passwordInputResult.kdfConfig,
    );

    const [newUserKey, newEncUserKey] = await this.keyService.makeUserKey(newMasterKey);

    if (!newUserKey || !newEncUserKey) {
      throw new Error("User key could not be created");
    }
    const userAsymmetricKeys = await this.keyService.makeKeyPair(newUserKey);

    const registerRequest = await this.buildRegisterRequest(
      newUserKey,
      email,
      passwordInputResult,
      userAsymmetricKeys,
      emailVerificationToken,
      orgSponsoredFreeFamilyPlanToken,
      acceptEmergencyAccessInviteToken,
      emergencyAccessId,
      providerInviteToken,
      providerUserId,
    );

    return await this.accountApiService.registerFinish(registerRequest);
  }

  protected async buildRegisterRequest(
    newUserKey: UserKey,
    email: string,
    passwordInputResult: PasswordInputResult,
    userAsymmetricKeys: [string, EncString],
    emailVerificationToken?: string,
    orgSponsoredFreeFamilyPlanToken?: string, // web only
    acceptEmergencyAccessInviteToken?: string, // web only
    emergencyAccessId?: string, // web only
    providerInviteToken?: string, // web only
    providerUserId?: string, // web only
  ): Promise<RegisterFinishRequest> {
    const userAsymmetricKeysRequest = new KeysRequest(
      userAsymmetricKeys[0],
      userAsymmetricKeys[1].encryptedString,
    );

    const masterPasswordAuthentication =
      await this.masterPasswordService.makeMasterPasswordAuthenticationData(
        passwordInputResult.newPassword,
        passwordInputResult.kdfConfig,
        passwordInputResult.salt,
      );

    const masterPasswordUnlock = await this.masterPasswordService.makeMasterPasswordUnlockData(
      passwordInputResult.newPassword,
      passwordInputResult.kdfConfig,
      passwordInputResult.salt,
      newUserKey,
    );

    const registerFinishRequest = new RegisterFinishRequest(
      email,
      passwordInputResult.newPasswordHint,
      userAsymmetricKeysRequest,
      masterPasswordAuthentication,
      masterPasswordUnlock,
    );

    if (emailVerificationToken) {
      registerFinishRequest.emailVerificationToken = emailVerificationToken;
    }

    return registerFinishRequest;
  }
}
