// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { KdfType } from "@bitwarden/key-management";

import { EncString } from "../../../key-management/crypto/models/enc-string";
import { BaseResponse } from "../../../models/response/base.response";

import { MasterPasswordPolicyResponse } from "./master-password-policy.response";
import { UserDecryptionOptionsResponse } from "./user-decryption-options/user-decryption-options.response";

export class IdentityTokenResponse extends BaseResponse {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  tokenType: string;

  resetMasterPassword: boolean;
  privateKey: string; // userKeyEncryptedPrivateKey
  key?: EncString; // masterKeyEncryptedUserKey
  twoFactorToken: string;
  kdf: KdfType;
  kdfIterations: number;
  kdfMemory?: number;
  kdfParallelism?: number;
  forcePasswordReset: boolean;
  masterPasswordPolicy: MasterPasswordPolicyResponse;
  apiUseKeyConnector: boolean;
  keyConnectorUrl: string;

  userDecryptionOptions: UserDecryptionOptionsResponse;

  constructor(response: any) {
    super(response);
    this.accessToken = response.access_token;
    this.expiresIn = response.expires_in;
    this.refreshToken = response.refresh_token;
    this.tokenType = response.token_type;

    this.resetMasterPassword = this.getResponseProperty("ResetMasterPassword");
    this.privateKey = this.getResponseProperty("PrivateKey");
    const key = this.getResponseProperty("Key");
    if (key) {
      this.key = new EncString(key);
    }
    this.twoFactorToken = this.getResponseProperty("TwoFactorToken");
    this.kdf = this.getResponseProperty("Kdf");
    this.kdfIterations = this.getResponseProperty("KdfIterations");
    this.kdfMemory = this.getResponseProperty("KdfMemory");
    this.kdfParallelism = this.getResponseProperty("KdfParallelism");
    this.forcePasswordReset = this.getResponseProperty("ForcePasswordReset");
    this.apiUseKeyConnector = this.getResponseProperty("ApiUseKeyConnector");
    this.keyConnectorUrl = this.getResponseProperty("KeyConnectorUrl");
    this.masterPasswordPolicy = new MasterPasswordPolicyResponse(
      this.getResponseProperty("MasterPasswordPolicy"),
    );

    if (response.UserDecryptionOptions) {
      this.userDecryptionOptions = new UserDecryptionOptionsResponse(
        this.getResponseProperty("UserDecryptionOptions"),
      );
    }
  }

  hasMasterKeyEncryptedUserKey(): boolean {
    return Boolean(this.key);
  }
}
