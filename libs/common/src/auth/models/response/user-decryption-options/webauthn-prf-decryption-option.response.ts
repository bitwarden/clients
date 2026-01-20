// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { UnsignedSharedKey } from "@bitwarden/sdk-internal";

import { EncString } from "../../../../key-management/crypto/models/enc-string";
import { BaseResponse } from "../../../../models/response/base.response";

export interface IWebAuthnPrfDecryptionOptionServerResponse {
  EncryptedPrivateKey: string;
  EncryptedUserKey: string;
}

export class WebAuthnPrfDecryptionOptionResponse extends BaseResponse {
  encryptedPrivateKey: EncString;
  encryptedUserKey: UnsignedSharedKey;

  constructor(response: IWebAuthnPrfDecryptionOptionServerResponse) {
    super(response);
    if (response.EncryptedPrivateKey) {
      this.encryptedPrivateKey = new EncString(this.getResponseProperty("EncryptedPrivateKey"));
    }
    if (response.EncryptedUserKey) {
      this.encryptedUserKey = this.getResponseProperty("EncryptedUserKey") as UnsignedSharedKey;
    }
  }
}
