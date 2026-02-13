// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { AccountApiService } from "@bitwarden/common/auth/abstractions/account-api.service";
import { RegisterFinishV2Request } from "@bitwarden/common/auth/models/request/registration/register-finish-v2.request";
import { RegisterFinishRequest } from "@bitwarden/common/auth/models/request/registration/register-finish.request";
import { assertNonNullish, assertTruthy } from "@bitwarden/common/auth/utils";
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
    /**
     * "KM flag"   = (does not yet exist for registration — KM team has an in-progress PR)
     * "Auth flag" = PM27086_UpdateAuthenticationApisForInputPassword (checked in InputPasswordComponent
     *               and passed through via PasswordInputResult.newApisWithInputPasswordFlagEnabled)
     *
     * Flag unwinding will depend on which flag gets unwound first:
     * - If KM flag gets unwound first, remove all code after the KM V2 path,
     *   as the V2Encryption method is the end-goal.
     * - If Auth flag gets unwound first (in PM-28143), keep the KM code & early return,
     *   but unwind the auth flagging logic and remove the "Scenario 2" code.
     */

    // Scenario 1: KM V2 flag ON (placeholder — to be added when KM's registration V2 PR lands)
    // const accountEncryptionV2 = await this.configService.getFeatureFlag(
    //   FeatureFlag.EnableAccountEncryptionV2Registration, // flag name TBD by KM team
    // );
    // if (accountEncryptionV2) {
    //   // SDK path — end goal. Replaces all key derivation below.
    //   return;
    // }

    let newUserKey: UserKey;
    let newEncUserKey: EncString;

    // Scenario 2: KM flag OFF, Auth flag ON
    if (passwordInputResult.newApisWithInputPasswordFlagEnabled) {
      /**
       * If the Auth flag is enabled, it means the InputPasswordComponent will not emit a newMasterKey,
       * newServerMasterKeyHash, and newLocalMasterKeyHash. So we must create them here.
       *
       * This is a temporary state. The end-goal will be to use KM's V2Encryption method above.
       */
      const ctx = "Could not finish registration.";
      assertTruthy(passwordInputResult.newPassword, "newPassword", ctx);
      assertNonNullish(passwordInputResult.kdfConfig, "kdfConfig", ctx);
      assertTruthy(email, "email", ctx);

      const newMasterKey = await this.keyService.makeMasterKey(
        passwordInputResult.newPassword,
        email.trim().toLowerCase(),
        passwordInputResult.kdfConfig,
      );

      [newUserKey, newEncUserKey] = await this.keyService.makeUserKey(newMasterKey);
    } else {
      [newUserKey, newEncUserKey] = await this.keyService.makeUserKey(
        passwordInputResult.newMasterKey,
      );
    }

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

    const useNewApi = passwordInputResult.newApisWithInputPasswordFlagEnabled ?? false;

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
