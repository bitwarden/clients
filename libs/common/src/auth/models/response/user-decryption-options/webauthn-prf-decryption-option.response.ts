// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { EncString } from "@bitwarden/common/key-management/crypto/models/domain/enc-string";

import { BaseResponse } from "../../../../models/response/base.response";

export interface IWebAuthnPrfDecryptionOptionServerResponse {
  EncryptedPrivateKey: string;
  EncryptedUserKey: string;
}

export class WebAuthnPrfDecryptionOptionResponse extends BaseResponse {
  encryptedPrivateKey: EncString;
  encryptedUserKey: EncString;

  constructor(response: IWebAuthnPrfDecryptionOptionServerResponse) {
    super(response);
    if (response.EncryptedPrivateKey) {
      this.encryptedPrivateKey = new EncString(this.getResponseProperty("EncryptedPrivateKey"));
    }
    if (response.EncryptedUserKey) {
      this.encryptedUserKey = new EncString(this.getResponseProperty("EncryptedUserKey"));
    }
  }
}
