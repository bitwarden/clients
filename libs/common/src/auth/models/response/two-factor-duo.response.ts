import { BaseResponse } from "../../../models/response/base.response";

export class TwoFactorDuoResponse extends BaseResponse {
  enabled: boolean;
  host: string;
  clientSecret: string;
  clientId: string;

  constructor(response: any) {
    super(response);
    this.enabled = this.getResponseProperty("Enabled");
    this.host = this.getResponseProperty("Host");
    this.clientSecret = this.getResponseProperty("ClientSecret");
    this.clientId = this.getResponseProperty("ClientId");
  }
}
