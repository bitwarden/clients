// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { Argon2KdfConfig, KdfConfig, KdfType, PBKDF2KdfConfig } from "@bitwarden/key-management";
import { KeyConnectorUnlockData } from "@bitwarden/unlock";

import { EncString } from "../../../key-management/crypto/models/enc-string";
import { PrivateKeysResponseModel } from "../../../key-management/keys/response/private-keys.response";
import { BaseResponse } from "../../../models/response/base.response";

import { MasterPasswordPolicyResponse } from "./master-password-policy.response";
import { UserDecryptionOptionsResponse } from "./user-decryption-options/user-decryption-options.response";

export class IdentityTokenResponse extends BaseResponse {
  // Authentication Information
  accessToken: string;
  expiresIn?: number;
  refreshToken?: string;
  tokenType: string;

  // Decryption Information

  /**
   * privateKey is actually userKeyEncryptedPrivateKey
   * @deprecated Use {@link accountKeysResponseModel} instead
   */
  privateKey: string;

  // TODO: https://bitwarden.atlassian.net/browse/PM-30124 - Rename to just accountKeys
  accountKeysResponseModel: PrivateKeysResponseModel | null = null;

  /**
   * key is actually masterKeyEncryptedUserKey
   * @deprecated Use {@link userDecryptionOptions.masterPasswordUnlock.masterKeyWrappedUserKey} instead
   */
  key?: EncString;
  twoFactorToken: string;
  kdfConfig: KdfConfig;
  forcePasswordReset: boolean;
  masterPasswordPolicy: MasterPasswordPolicyResponse;
  apiUseKeyConnector: boolean;

  userDecryptionOptions?: UserDecryptionOptionsResponse;

  constructor(response: unknown) {
    super(response);

    const accessToken = this.getResponseProperty("access_token");
    if (accessToken == null || typeof accessToken !== "string") {
      throw new Error("Identity response does not contain a valid access token");
    }
    const tokenType = this.getResponseProperty("token_type");
    if (tokenType == null || typeof tokenType !== "string") {
      throw new Error("Identity response does not contain a valid token type");
    }
    this.accessToken = accessToken;
    this.tokenType = tokenType;

    const expiresIn = this.getResponseProperty("expires_in");
    if (expiresIn != null && typeof expiresIn === "number") {
      this.expiresIn = expiresIn;
    }
    const refreshToken = this.getResponseProperty("refresh_token");
    if (refreshToken != null && typeof refreshToken === "string") {
      this.refreshToken = refreshToken;
    }

    this.privateKey = this.getResponseProperty("PrivateKey");
    if (this.getResponseProperty("AccountKeys") != null) {
      this.accountKeysResponseModel = new PrivateKeysResponseModel(
        this.getResponseProperty("AccountKeys"),
      );
    }
    const key = this.getResponseProperty("Key");
    if (key) {
      this.key = new EncString(key);
    }
    this.twoFactorToken = this.getResponseProperty("TwoFactorToken");

    const kdf = this.getResponseProperty("Kdf");
    const kdfIterations = this.getResponseProperty("KdfIterations");
    const kdfMemory = this.getResponseProperty("KdfMemory");
    const kdfParallelism = this.getResponseProperty("KdfParallelism");

    switch (kdf) {
      case KdfType.PBKDF2_SHA256:
        this.kdfConfig = new PBKDF2KdfConfig(kdfIterations);
        break;
      case KdfType.Argon2id:
        this.kdfConfig = new Argon2KdfConfig(kdfIterations, kdfMemory, kdfParallelism);
        break;
      default:
        throw new Error("kdf is required on IdentityTokenResponse");
    }

    this.forcePasswordReset = this.getResponseProperty("ForcePasswordReset");
    this.apiUseKeyConnector = this.getResponseProperty("ApiUseKeyConnector");

    this.masterPasswordPolicy = new MasterPasswordPolicyResponse(
      this.getResponseProperty("MasterPasswordPolicy"),
    );

    const userDecryptionOptions = this.getResponseProperty("UserDecryptionOptions");
    if (userDecryptionOptions != null && typeof userDecryptionOptions === "object") {
      this.userDecryptionOptions = new UserDecryptionOptionsResponse(userDecryptionOptions);
    }
  }

  hasMasterKeyEncryptedUserKey(): boolean {
    return Boolean(this.key);
  }

  canUnlockWithKeyConnector(): boolean {
    return this.userDecryptionOptions?.keyConnectorOption != null;
  }

  intoKeyConnectorUnlockData(): KeyConnectorUnlockData {
    if (!this.canUnlockWithKeyConnector()) {
      throw new Error("Identity token response cannot be used for key connector unlock");
    }

    return {
      url: this.userDecryptionOptions!.keyConnectorOption.keyConnectorUrl,
      keyConnectorKeyWrappedUserKey: this.key.toSdk(),
    };
  }
}
