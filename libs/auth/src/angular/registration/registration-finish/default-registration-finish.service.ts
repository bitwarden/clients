// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { AccountApiService } from "@bitwarden/common/auth/abstractions/account-api.service";
import { RegisterFinishV2Request } from "@bitwarden/common/auth/models/request/registration/register-finish-v2.request";
import { RegisterFinishRequest } from "@bitwarden/common/auth/models/request/registration/register-finish.request";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import {
  EncryptedString,
  EncString,
} from "@bitwarden/common/key-management/crypto/models/enc-string";
import { MasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { KeysRequest } from "@bitwarden/common/models/request/keys.request";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { UserKey } from "@bitwarden/common/types/key";
import { Argon2KdfConfig, KeyService, KdfType } from "@bitwarden/key-management";

import { PasswordInputResult } from "../../input-password/password-input-result";

import { RegistrationFinishService } from "./registration-finish.service";

export class DefaultRegistrationFinishService implements RegistrationFinishService {
  constructor(
    protected keyService: KeyService,
    protected accountApiService: AccountApiService,
    protected masterPasswordService: MasterPasswordServiceAbstraction,
    protected configService: ConfigService,
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
    const [newUserKey, newEncUserKey] = await this.keyService.makeUserKey(
      passwordInputResult.newMasterKey,
    );

    if (!newUserKey || !newEncUserKey) {
      throw new Error("User key could not be created");
    }
    const userAsymmetricKeys = await this.keyService.makeKeyPair(newUserKey);

    const registerRequest = await this.buildRegisterRequest(
      newUserKey,
      email,
      passwordInputResult,
      newEncUserKey.encryptedString,
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
    encryptedUserKey: EncryptedString,
    userAsymmetricKeys: [string, EncString],
    emailVerificationToken?: string,
    orgSponsoredFreeFamilyPlanToken?: string, // web only
    acceptEmergencyAccessInviteToken?: string, // web only
    emergencyAccessId?: string, // web only
    providerInviteToken?: string, // web only
    providerUserId?: string, // web only
  ): Promise<RegisterFinishRequest | RegisterFinishV2Request> {
    const userAsymmetricKeysRequest = new KeysRequest(
      userAsymmetricKeys[0],
      userAsymmetricKeys[1].encryptedString,
    );

    const useNewApi = await this.configService.getFeatureFlag(
      FeatureFlag.PM27044_UpdateRegistrationApis,
    );

    if (useNewApi) {
      // New API path - use V2 request with new data types
      const salt = this.masterPasswordService.emailToSalt(email);

      const masterPasswordAuthentication =
        await this.masterPasswordService.makeMasterPasswordAuthenticationData(
          passwordInputResult.newPassword,
          passwordInputResult.kdfConfig,
          salt,
        );

      const masterPasswordUnlock = await this.masterPasswordService.makeMasterPasswordUnlockData(
        passwordInputResult.newPassword,
        passwordInputResult.kdfConfig,
        salt,
        newUserKey,
      );

      const registerFinishRequest = new RegisterFinishV2Request(
        email,
        passwordInputResult.newServerMasterKeyHash,
        passwordInputResult.newPasswordHint,
        encryptedUserKey,
        userAsymmetricKeysRequest,
        masterPasswordAuthentication,
        masterPasswordUnlock,
      );

      if (emailVerificationToken) {
        registerFinishRequest.emailVerificationToken = emailVerificationToken;
      }

      return registerFinishRequest;
    } else {
      // Old API path - use original request with KDF fields
      const kdfConfig = passwordInputResult.kdfConfig;

      const registerFinishRequest = new RegisterFinishRequest(
        email,
        passwordInputResult.newServerMasterKeyHash,
        passwordInputResult.newPasswordHint,
        encryptedUserKey,
        userAsymmetricKeysRequest,
        kdfConfig.kdfType,
        kdfConfig.iterations,
        kdfConfig.kdfType === KdfType.Argon2id ? (kdfConfig as Argon2KdfConfig).memory : undefined,
        kdfConfig.kdfType === KdfType.Argon2id
          ? (kdfConfig as Argon2KdfConfig).parallelism
          : undefined,
      );

      if (emailVerificationToken) {
        registerFinishRequest.emailVerificationToken = emailVerificationToken;
      }

      return registerFinishRequest;
    }
  }
}
