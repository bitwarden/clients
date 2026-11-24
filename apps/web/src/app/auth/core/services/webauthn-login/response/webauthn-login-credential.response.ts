// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { RotateableKeySet } from "@bitwarden/common/key-management/keys/models/rotateable-key-set";
import { BaseResponse } from "@bitwarden/common/models/response/base.response";
// eslint-disable-next-line no-restricted-imports
import { isSerializedEncString } from "@bitwarden/legacy-crypto";
import { EncString } from "@bitwarden/sdk-internal";

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
    if (!isSerializedEncString(this.encryptedUserKey)) {
      throw new Error("Invalid encrypted user key");
    }
    if (!isSerializedEncString(this.encryptedPublicKey)) {
      throw new Error("Invalid encrypted public key");
    }

    return new RotateableKeySet(
      this.encryptedUserKey as EncString,
      this.encryptedPublicKey as EncString,
    );
  }

  hasPrfKeyset(): boolean {
    return this.prfStatus === WebauthnLoginCredentialPrfStatus.Enabled;
  }
}
