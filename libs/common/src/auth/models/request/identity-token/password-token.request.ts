import { ClientType } from "../../../../enums";

import { DeviceRequest } from "./device.request";
import { TokenTwoFactorRequest } from "./token-two-factor.request";
import { TokenRequest } from "./token.request";

export class PasswordTokenRequest extends TokenRequest {
  constructor(
    public email: string,
    public masterPasswordHash: string,
    protected twoFactor: TokenTwoFactorRequest,
    device?: DeviceRequest,
    public newDeviceOtp?: string,
  ) {
    super(twoFactor, device);
  }

  toIdentityToken(clientId: ClientType) {
    const obj = super.toIdentityToken(clientId);

    obj.grant_type = "password";
    obj.username = this.email;
    obj.password = this.masterPasswordHash;

    if (this.newDeviceOtp) {
      obj.newDeviceOtp = this.newDeviceOtp;
    }

    return obj;
  }

  static fromJSON(json: any) {
    return Object.assign(Object.create(PasswordTokenRequest.prototype), json, {
      device: json.device ? DeviceRequest.fromJSON(json.device) : undefined,
      twoFactor: json.twoFactor
        ? Object.assign(new TokenTwoFactorRequest(), json.twoFactor)
        : undefined,
    });
  }
}
