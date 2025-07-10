import { DeviceRequest } from "./device.request";
import { TokenTwoFactorRequest } from "./token-two-factor.request";
import { TokenRequest } from "./token.request";

export class SsoTokenRequest extends TokenRequest {
  constructor(
    public code: string,
    public codeVerifier: string,
    public redirectUri: string,
    protected twoFactor: TokenTwoFactorRequest,
    device?: DeviceRequest,
  ) {
    super(twoFactor, device);
  }

  toIdentityToken(clientId: string) {
    const obj = super.toIdentityToken(clientId);

    obj.grant_type = "authorization_code";
    obj.code = this.code;
    obj.code_verifier = this.codeVerifier;
    obj.redirect_uri = this.redirectUri;

    return obj;
  }

  static fromJSON(json: any) {
    return Object.assign(Object.create(SsoTokenRequest.prototype), json, {
      device: json.device ? DeviceRequest.fromJSON(json.device) : undefined,
      twoFactor: json.twoFactor
        ? Object.assign(new TokenTwoFactorRequest(), json.twoFactor)
        : undefined,
    });
  }
}
