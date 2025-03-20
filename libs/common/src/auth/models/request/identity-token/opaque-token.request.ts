import { ClientType } from "../../../../enums";
import { Utils } from "../../../../platform/misc/utils";

import { DeviceRequest } from "./device.request";
import { TokenTwoFactorRequest } from "./token-two-factor.request";
import { TokenRequest } from "./token.request";

// TODO: we might have to support both login start and login finish requests within this?
// or, we could have separate OpaqueStartTokenRequest and OpaqueFinishTokenRequest classes
export class OpaqueTokenRequest extends TokenRequest {
  constructor(
    public email: string,
    protected twoFactor: TokenTwoFactorRequest,
    public sessionId: string,
    device?: DeviceRequest,
    public newDeviceOtp?: string,
  ) {
    super(twoFactor, device);
  }

  toIdentityToken(clientId: ClientType) {
    const obj = super.toIdentityToken(clientId);

    // TODO: what grant type for OPAQUE?
    obj.grant_type = "opaque-ke";
    obj.username = this.email;
    obj.sessionId = this.sessionId;

    if (this.newDeviceOtp) {
      obj.newDeviceOtp = this.newDeviceOtp;
    }

    return obj;
  }

  alterIdentityTokenHeaders(headers: Headers) {
    headers.set("Auth-Email", Utils.fromUtf8ToUrlB64(this.email));
  }

  static fromJSON(json: any) {
    return Object.assign(Object.create(OpaqueTokenRequest.prototype), json, {
      device: json.device ? DeviceRequest.fromJSON(json.device) : undefined,
      twoFactor: json.twoFactor
        ? Object.assign(new TokenTwoFactorRequest(), json.twoFactor)
        : undefined,
    });
  }
}
