// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { RotateableKeySet } from "@bitwarden/auth/common";
import { BaseResponse } from "@bitwarden/common/models/response/base.response";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";

import { WebauthnLoginCredentialPrfStatus } from "../../../enums/webauthn-login-credential-prf-status.enum";

/**
 * A webauthn login credential received from the server.
 */
export class WebauthnLoginCredentialResponse extends BaseResponse {
  id: string;
  name: string;
  prfStatus: WebauthnLoginCredentialPrfStatus;
  encryptedPublicKey?: string;
  encryptedUserKey?: string;

  constructor(response: unknown) {
    super(response);
    this.id = this.getResponseProperty("Id");
    this.name = this.getResponseProperty("Name");
    this.prfStatus = this.getResponseProperty("PrfStatus");
    this.encryptedPublicKey = this.getResponseProperty("EncryptedPublicKey");
    this.encryptedUserKey = this.getResponseProperty("EncryptedUserKey");
  }

  getRotateableKeyset(): RotateableKeySet {
    if (!EncString.isSerializedEncString(this.encryptedUserKey)) {
      throw new Error("Invalid encrypted user key");
    }
    if (!EncString.isSerializedEncString(this.encryptedPublicKey)) {
      throw new Error("Invalid encrypted public key");
    }

    return new RotateableKeySet(
      new EncString(this.encryptedUserKey),
      new EncString(this.encryptedPublicKey),
    );
  }

  hasPrfKeyset(): boolean {
    return this.encryptedUserKey != null && this.encryptedPublicKey != null;
  }
}
