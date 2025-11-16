// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Jsonify } from "type-fest";

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

    // if (!(credential.response instanceof AuthenticatorAssertionResponse)) {
    //   throw new Error("Invalid authenticator response");
    // }
    const resp = credential.response as AuthenticatorAssertionResponse;

    this.response = {
      authenticatorData: Utils.fromBufferToUrlB64(resp.authenticatorData),
      signature: Utils.fromBufferToUrlB64(resp.signature),
      clientDataJSON: Utils.fromBufferToUrlB64((resp as any).clientDataJson),
      userHandle: Utils.fromBufferToUrlB64(resp.userHandle),
    };
  }

  static fromJSON(json: Jsonify<WebAuthnLoginAssertionResponseRequest>) {
    return Object.assign(Object.create(WebAuthnLoginAssertionResponseRequest.prototype), json);
  }
}
