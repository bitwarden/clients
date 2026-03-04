// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { EncString } from "../../../../key-management/crypto/models/enc-string";
import { BaseResponse } from "../../../../models/response/base.response";

export interface IWebAuthnPrfDecryptionOptionServerResponse {
  EncryptedPrivateKey: string;
  EncryptedUserKey: string;
  CredentialId: string;
  Transports: string[];
}

export class WebAuthnPrfDecryptionOptionResponse extends BaseResponse {
  encryptedPrivateKey: EncString;
  encryptedUserKey: EncString;
  credentialId: string;
  transports: string[];

  constructor(response: IWebAuthnPrfDecryptionOptionServerResponse) {
    super(response);

    const encPrivateKey = this.getResponseProperty("EncryptedPrivateKey");
    if (encPrivateKey) {
      this.encryptedPrivateKey = new EncString(encPrivateKey);
    }

    const encUserKey = this.getResponseProperty("EncryptedUserKey");
    if (encUserKey) {
      this.encryptedUserKey = new EncString(encUserKey);
    }

    this.credentialId = this.getResponseProperty("CredentialId");
    this.transports = this.getResponseProperty("Transports") || [];
  }
}
