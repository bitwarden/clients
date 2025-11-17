// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Jsonify } from "type-fest";

import { PublicKeyCredential } from "@bitwarden/common/auth/abstractions/webauthn/navigator-credentials.service";

import { Utils } from "../../../../platform/misc/utils";

import { WebAuthnLoginResponseRequest } from "./webauthn-login-response.request";

// base 64 strings
export interface WebAuthnLoginAssertionResponseData {
  authenticatorData: string;
  signature: string;
  clientDataJSON: string;
  userHandle: string;
}

export class WebAuthnLoginAssertionResponseRequest extends WebAuthnLoginResponseRequest {
  response: WebAuthnLoginAssertionResponseData;

  constructor(credential: PublicKeyCredential) {
    super(credential);

    this.response = {
      authenticatorData: Utils.fromBufferToUrlB64(
        credential.response.authenticatorData.buffer as ArrayBuffer,
      ),
      signature: Utils.fromBufferToUrlB64(credential.response.signature.buffer as ArrayBuffer),
      clientDataJSON: Utils.fromBufferToUrlB64(
        credential.response.clientDataJSON.buffer as ArrayBuffer,
      ),
      userHandle: Utils.fromBufferToUrlB64(credential.response.userHandle.buffer as ArrayBuffer),
    };
  }

  static fromJSON(json: Jsonify<WebAuthnLoginAssertionResponseRequest>) {
    return Object.assign(Object.create(WebAuthnLoginAssertionResponseRequest.prototype), json);
  }
}
