// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { Argon2KdfConfig, KdfConfig, KdfType, PBKDF2KdfConfig } from "@bitwarden/key-management";

import { EncString } from "../../../key-management/crypto/models/enc-string";
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
  resetMasterPassword: boolean;
  privateKey: string; // userKeyEncryptedPrivateKey
  key?: EncString; // masterKeyEncryptedUserKey
  twoFactorToken: string;
  kdfConfig: KdfConfig;
  forcePasswordReset: boolean;
  masterPasswordPolicy: MasterPasswordPolicyResponse;
  apiUseKeyConnector: boolean;
  keyConnectorUrl: string;

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

    this.resetMasterPassword = this.getResponseProperty("ResetMasterPassword");
    this.privateKey = this.getResponseProperty("PrivateKey");
    const key = this.getResponseProperty("Key");
    if (key) {
      this.key = new EncString(key);
    }
    this.twoFactorToken = this.getResponseProperty("TwoFactorToken");
    const kdf = this.getResponseProperty("Kdf");
    const kdfIterations = this.getResponseProperty("KdfIterations");
    const kdfMemory = this.getResponseProperty("KdfMemory");
    const kdfParallelism = this.getResponseProperty("KdfParallelism");
    this.kdfConfig =
      kdf == KdfType.PBKDF2_SHA256
        ? new PBKDF2KdfConfig(kdfIterations)
        : new Argon2KdfConfig(kdfIterations, kdfMemory, kdfParallelism);
    this.forcePasswordReset = this.getResponseProperty("ForcePasswordReset");
    this.apiUseKeyConnector = this.getResponseProperty("ApiUseKeyConnector");
    this.keyConnectorUrl = this.getResponseProperty("KeyConnectorUrl");
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
}
