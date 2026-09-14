// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
// eslint-disable-next-line no-restricted-imports
import { EncString } from "@bitwarden/legacy-crypto";
import {
  UnsignedSharedKey,
  WebAuthnPrfUnlockOption as SdkWebAuthnPrfUnlockOption,
} from "@bitwarden/sdk-internal";

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

  /**
   * Converts this response into the SDK's unlock option shape.
   *
   * @returns The SDK unlock option, or `undefined` when the server omitted either wrapped key,
   * since an option without both keys cannot unlock anything.
   */
  toWebAuthnPrfUnlockOption(): SdkWebAuthnPrfUnlockOption | undefined {
    if (!this.encryptedPrivateKey || !this.encryptedUserKey) {
      return undefined;
    }

    return {
      encryptedPrivateKey: this.encryptedPrivateKey.toSdk(),
      encryptedUserKey: this.encryptedUserKey.toJSON() as UnsignedSharedKey,
      credentialId: this.credentialId,
      transports: this.transports,
    };
  }
}
