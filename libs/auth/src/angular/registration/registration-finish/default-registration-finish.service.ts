import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { AccountApiService } from "@bitwarden/common/auth/abstractions/account-api.service";
import { RegisterFinishRequest } from "@bitwarden/common/auth/models/request/registration/register-finish.request";
import { KeysRequest } from "@bitwarden/common/models/request/keys.request";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { EncryptedString, EncString } from "@bitwarden/common/platform/models/domain/enc-string";

import { PasswordInputResult } from "../../input-password/password-input-result";

import { RegistrationFinishService } from "./registration-finish.service";

export class DefaultRegistrationFinishService implements RegistrationFinishService {
  constructor(
    protected cryptoService: CryptoService,
    protected accountApiService: AccountApiService,
  ) {}

  getMasterPasswordPolicyOptsFromOrgInvite(): Promise<MasterPasswordPolicyOptions | null> {
    return null;
  }

  async finishRegistration(
    email: string,
    passwordInputResult: PasswordInputResult,
    emailVerificationToken?: string,
  ): Promise<string> {
    const [newUserKey, newEncUserKey] = await this.cryptoService.makeUserKey(
      passwordInputResult.masterKey,
    );

    if (!newUserKey || !newEncUserKey) {
      throw new Error("User key could not be created");
    }
    const userAsymmetricKeys = await this.cryptoService.makeKeyPair(newUserKey);

    const registerRequest = await this.buildRegisterRequest(
      email,
      emailVerificationToken,
      passwordInputResult,
      newEncUserKey.encryptedString,
      userAsymmetricKeys,
    );

    const capchaBypassToken = await this.accountApiService.registerFinish(registerRequest);

    return capchaBypassToken;
  }

  protected async buildRegisterRequest(
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

    return new RegisterFinishRequest(
      email,
      emailVerificationToken,
      passwordInputResult.masterKeyHash,
      passwordInputResult.hint,
      encryptedUserKey,
      userAsymmetricKeysRequest,
      passwordInputResult.kdfConfig.kdfType,
      passwordInputResult.kdfConfig.iterations,
    );
  }
}
