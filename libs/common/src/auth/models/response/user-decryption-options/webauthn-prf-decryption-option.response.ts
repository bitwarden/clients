// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { BaseResponse } from "../../../../models/response/base.response";
import { EncString } from "../../../../platform/models/domain/enc-string";

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
