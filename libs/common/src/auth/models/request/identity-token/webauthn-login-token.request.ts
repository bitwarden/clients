import { WebAuthnLoginAssertionResponseRequest } from "../../../services/webauthn-login/request/webauthn-login-assertion-response.request";

import { DeviceRequest } from "./device.request";
import { TokenTwoFactorRequest } from "./token-two-factor.request";
import { TokenRequest } from "./token.request";

export class WebAuthnLoginTokenRequest extends TokenRequest {
  constructor(
    public token: string,
    public deviceResponse: WebAuthnLoginAssertionResponseRequest,
    device?: DeviceRequest,
  ) {
    super(undefined, device);
  }

  toIdentityToken(clientId: string) {
    const obj = super.toIdentityToken(clientId);

    obj.grant_type = "webauthn";
    obj.token = this.token;
    // must be a string b/c sending as form encoded data
    obj.deviceResponse = JSON.stringify(this.deviceResponse);

    return obj;
  }

  static fromJSON(json: any) {
    return Object.assign(Object.create(WebAuthnLoginTokenRequest.prototype), json, {
      deviceResponse: WebAuthnLoginAssertionResponseRequest.fromJSON(json.deviceResponse),
      device: json.device ? DeviceRequest.fromJSON(json.device) : undefined,
      twoFactor: json.twoFactor
        ? Object.assign(new TokenTwoFactorRequest(), json.twoFactor)
        : undefined,
    });
  }
}
