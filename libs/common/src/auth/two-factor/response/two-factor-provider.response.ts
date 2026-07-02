import { BaseResponse } from "../../../models/response/base.response";
import { TwoFactorProviderType } from "../../enums/two-factor-provider-type";

export class TwoFactorProviderResponse extends BaseResponse {
  enabled: boolean;
  type: TwoFactorProviderType;

  constructor(response: any) {
    super(response);
    this.enabled = this.getResponseProperty("Enabled");
    this.type = this.getResponseProperty("Type");
  }
}
